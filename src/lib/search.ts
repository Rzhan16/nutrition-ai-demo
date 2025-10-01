import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type {
  Supplement,
  SearchFilters,
  SearchResult,
  CategoryCount,
  SearchFacets,
} from '@/lib/types';

type SearchOptions = {
  page?: number;
  limit?: number;
  sortBy?: 'relevance' | 'name' | 'brand' | 'popularity' | 'created';
  sortOrder?: 'asc' | 'desc';
};

type SupplementWithCounts = Supplement & { _count?: { scans: number } };

type GroupedCategory = { category: string | null; _count: { category: number } };
type GroupedBrand = { brand: string | null; _count: { brand: number } };

export class SearchService {
  private cache = new Map<string, { data: SearchResult; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Main search method with comprehensive filtering and relevance scoring
   */
  async searchSupplements(
    query: string,
    filters?: SearchFilters,
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    const cacheKey = this.buildCacheKey(query, filters, options);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    const { page = 1, limit = 20, sortBy = 'relevance', sortOrder = 'desc' } = options;
    const offset = (page - 1) * limit;

    try {
      // Build search query
      const searchQuery = this.buildSearchQuery(query, filters);
      
      // Execute search with pagination
      const [supplements, totalCount] = await Promise.all([
        prisma.supplement.findMany({
          where: searchQuery,
          take: limit,
          skip: offset,
          orderBy: this.buildOrderBy(sortBy, sortOrder),
          include: {
            _count: {
              select: {
                scans: true
              }
            }
          }
        }),
        prisma.supplement.count({ where: searchQuery })
      ]);

      // Calculate relevance scores and re-sort if needed
      const scoredSupplements: SupplementWithCounts[] = supplements.map((supplement) => {
        const withScore: SupplementWithCounts = {
          ...(supplement as SupplementWithCounts),
          relevanceScore: this.calculateRelevanceScore(supplement as Supplement, query),
        };
        return withScore;
      });

      if (sortBy === 'relevance') {
        scoredSupplements.sort((a, b) =>
          sortOrder === 'desc'
            ? (b.relevanceScore || 0) - (a.relevanceScore || 0)
            : (a.relevanceScore || 0) - (b.relevanceScore || 0)
        );
      }

      // Generate suggestions and facets
      const [suggestions, categories, facets] = await Promise.all([
        this.getAutocompleteSuggestions(query),
        this.getCategoryCounts(searchQuery),
        this.getSearchFacets(searchQuery)
      ]);

      const result: SearchResult = {
        supplements: scoredSupplements,
        totalCount,
        suggestions,
        categories,
        facets,
        searchTime: Date.now() - startTime
      };

      this.setCache(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Search error:', error);
      return {
        supplements: [],
        totalCount: 0,
        suggestions: [],
        categories: [],
        facets: { brands: [], categories: [], priceRanges: [] },
        searchTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get autocomplete suggestions based on partial input
   */
  async getAutocompleteSuggestions(partial: string): Promise<string[]> {
    if (!partial || partial.length < 2) return [];

    try {
      const supplements = await prisma.supplement.findMany({
        where: {
          OR: [
            { name: { contains: partial } },
            { brand: { contains: partial } },
            { category: { contains: partial } }
          ]
        },
        select: { name: true, brand: true, category: true },
        take: 10
      });

      const suggestions = new Set<string>();
      supplements.forEach((supplement) => {
        const { name, brand, category } = supplement;
        const lowerPartial = partial.toLowerCase();
        if (name?.toLowerCase().includes(lowerPartial)) {
          suggestions.add(name);
        }
        if (brand?.toLowerCase().includes(lowerPartial)) {
          suggestions.add(brand);
        }
        if (category?.toLowerCase().includes(lowerPartial)) {
          suggestions.add(category);
        }
      });

      return Array.from(suggestions).slice(0, 8);
    } catch (error) {
      console.error('Autocomplete error:', error);
      return [];
    }
  }

  /**
   * Get popular supplements based on scan count
   */
  async getPopularSupplements(limit: number = 10): Promise<Supplement[]> {
    try {
      const supplements = await prisma.supplement.findMany({
        include: {
          _count: {
            select: {
              scans: true
            }
          }
        },
        orderBy: {
          scans: {
            _count: 'desc'
          }
        },
        take: limit
      });

      return supplements;
    } catch (error) {
      console.error('Popular supplements error:', error);
      return [];
    }
  }

  /**
   * Search supplements by category
   */
  async searchByCategory(category: string): Promise<Supplement[]> {
    try {
      const supplements = await prisma.supplement.findMany({
        where: {
          category: {
            equals: category
          }
        },
        include: {
          _count: {
            select: {
              scans: true
            }
          }
        },
        orderBy: [
          { verified: 'desc' },
          { scans: { _count: 'desc' } },
          { name: 'asc' }
        ]
      });

      return supplements;
    } catch (error) {
      console.error('Category search error:', error);
      return [];
    }
  }

  /**
   * Get trending searches and popular categories
   */
  async getTrendingData(): Promise<{
    popularCategories: string[];
    recentSearches: string[];
    topBrands: string[];
  }> {
    try {
      const [categories, brands] = await Promise.all([
        prisma.supplement.groupBy({
          by: ['category'],
          _count: { category: true },
          orderBy: { _count: { category: 'desc' } },
          take: 10
        }),
        prisma.supplement.groupBy({
          by: ['brand'],
          _count: { brand: true },
          orderBy: { _count: { brand: 'desc' } },
          take: 10
        })
      ]);

      const popularCategories = categories
        .map((category) => category.category)
        .filter((value): value is string => typeof value === 'string');

      const topBrands = brands
        .map((brand) => brand.brand)
        .filter((value): value is string => typeof value === 'string');

      return {
        popularCategories,
        recentSearches: [], // Would need search history tracking
        topBrands,
      };
    } catch (error) {
      console.error('Trending data error:', error);
      return {
        popularCategories: [],
        recentSearches: [],
        topBrands: []
      };
    }
  }

  /**
   * Build search query with filters
   */
  private buildSearchQuery(query: string, filters?: SearchFilters): Prisma.SupplementWhereInput {
    const where: Prisma.SupplementWhereInput = {};

    // Text search across name, brand, category
    if (query && query.trim()) {
      const searchTerms = query.trim().split(/\s+/);
      where.OR = [
        // Exact matches get highest priority
        { name: { contains: query } },
        { brand: { contains: query } },
        { category: { contains: query } },
        // Individual word matches
        ...searchTerms.map(term => ({
          OR: [
            { name: { contains: term } },
            { brand: { contains: term } },
            { category: { contains: term } }
          ]
        }))
      ];
    }

    // Apply filters
    if (filters) {
      if (filters.category && filters.category.length > 0) {
        where.category = { in: filters.category };
      }

      if (filters.brand && filters.brand.length > 0) {
        where.brand = { in: filters.brand };
      }

      if (filters.verified !== undefined) {
        where.verified = filters.verified;
      }

      if (filters.ingredients && filters.ingredients.length > 0) {
        // Search in ingredients JSON field
        where.OR = [
          ...(where.OR || []),
          ...filters.ingredients.map(ingredient => ({
            ingredients: {
              path: '$[*].name',
              string_contains: ingredient
            }
          }))
        ];
      }
    }

    return where;
  }

  /**
   * Calculate relevance score for search results
   */
  private calculateRelevanceScore(supplement: Supplement, query: string): number {
    if (!query) return 0;

    const queryLower = query.toLowerCase();
    let score = 0;

    // Exact name match gets highest score
    if (supplement.name.toLowerCase() === queryLower) {
      score += 100;
    } else if (supplement.name.toLowerCase().includes(queryLower)) {
      score += 80;
    }

    // Brand match
    if (supplement.brand.toLowerCase() === queryLower) {
      score += 60;
    } else if (supplement.brand.toLowerCase().includes(queryLower)) {
      score += 40;
    }

    // Category match
    if (supplement.category.toLowerCase() === queryLower) {
      score += 30;
    } else if (supplement.category.toLowerCase().includes(queryLower)) {
      score += 20;
    }

    // Boost verified supplements
    if (supplement.verified) {
      score += 10;
    }

    // Boost popular supplements (based on scan count)
    const scanCount = supplement._count?.scans || 0;
    score += Math.min(scanCount * 2, 20);

    // Fuzzy matching bonus for partial words
    const words = queryLower.split(/\s+/);
    words.forEach(word => {
      if (word.length > 2) {
        [supplement.name, supplement.brand, supplement.category].forEach(field => {
          const fieldLower = field.toLowerCase();
          if (fieldLower.includes(word)) {
            score += 5;
          }
        });
      }
    });

    return score;
  }

  /**
   * Build order by clause for sorting
   */
  private buildOrderBy(
    sortBy: string,
    sortOrder: 'asc' | 'desc'
  ): Prisma.SupplementOrderByWithRelationInput | Prisma.SupplementOrderByWithRelationInput[] {
    switch (sortBy) {
      case 'name':
        return { name: sortOrder };
      case 'brand':
        return { brand: sortOrder };
      case 'popularity':
        return { scans: { _count: sortOrder } };
      case 'created':
        return { createdAt: sortOrder };
      case 'relevance':
      default:
        return [
          { verified: 'desc' },
          { scans: { _count: 'desc' } },
          { name: 'asc' }
        ];
    }
  }

  /**
   * Get category counts for faceted search
   */
  private async getCategoryCounts(searchQuery: Prisma.SupplementWhereInput): Promise<CategoryCount[]> {
    try {
      const categories = await prisma.supplement.groupBy({
        by: ['category'],
        where: searchQuery,
        _count: { category: true },
        orderBy: { _count: { category: 'desc' } }
      });

      return categories
        .filter((category): category is GroupedCategory & { category: string } => typeof category.category === 'string')
        .map((category) => ({
          category: category.category,
          count: category._count.category,
        }));
    } catch (error) {
      console.error('Category counts error:', error);
      return [];
    }
  }

  /**
   * Get search facets for filtering
   */
  private async getSearchFacets(searchQuery: Prisma.SupplementWhereInput): Promise<SearchFacets> {
    try {
      const [brands, categories] = await Promise.all([
        prisma.supplement.groupBy({
          by: ['brand'],
          where: searchQuery,
          _count: { brand: true },
          orderBy: { _count: { brand: 'desc' } },
          take: 20
        }),
        prisma.supplement.groupBy({
          by: ['category'],
          where: searchQuery,
          _count: { category: true },
          orderBy: { _count: { category: 'desc' } },
          take: 15
        })
      ]);

      return {
        brands: brands
          .filter((brand): brand is GroupedBrand & { brand: string } => typeof brand.brand === 'string')
          .map((brand) => ({ value: brand.brand, count: brand._count.brand })),
        categories: categories
          .filter((category): category is GroupedCategory & { category: string } => typeof category.category === 'string')
          .map((category) => ({ value: category.category, count: category._count.category })),
        priceRanges: [] // Would need price data
      };
    } catch (error) {
      console.error('Search facets error:', error);
      return { brands: [], categories: [], priceRanges: [] };
    }
  }

  /**
   * Cache management
   */
  private buildCacheKey(query: string, filters?: SearchFilters, options?: SearchOptions): string {
    return JSON.stringify({ query, filters, options });
  }

  private getFromCache(key: string): SearchResult | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCache(key: string, data: SearchResult): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const searchService = new SearchService();

// Clear cache every 10 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    searchService.clearExpiredCache();
  }, 10 * 60 * 1000);
} 
