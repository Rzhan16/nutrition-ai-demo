import { prisma } from "@/lib/db";

export interface SupplementDatabaseEntry {
  id?: string;
  name?: string | null;
  brand?: string | null;
  product?: string | null;
  category?: string | null;
}

export async function loadSupplementDatabase(): Promise<SupplementDatabaseEntry[]> {
  const entries: SupplementDatabaseEntry[] = [];

  if (prisma) {
    try {
      const supplements = await prisma.supplement.findMany({
        select: {
          id: true,
          name: true,
          brand: true,
          category: true,
        },
        take: 5000,
      });

      for (const supplement of supplements) {
        entries.push({
          id: supplement.id,
          name: supplement.name,
          brand: supplement.brand,
          product: supplement.name,
          category: supplement.category,
        });
      }
    } catch (error) {
      console.warn("Failed to load supplements from database:", error);
    }
  }

  return entries;
}
