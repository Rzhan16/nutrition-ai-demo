/**
 * Simple database fallback that doesn't require Prisma
 * Used when Prisma client is not available (e.g., on Vercel without database)
 */

export const db = {
  // Mock database operations
  supplement: {
    findMany: async () => [],
    findFirst: async () => null,
    count: async () => 0,
    create: async () => ({ id: 'mock-id' }),
    update: async () => ({ id: 'mock-id' })
  },
  scan: {
    findMany: async () => [],
    findFirst: async () => null,
    count: async () => 0,
    create: async () => ({ id: 'mock-scan-id' }),
    update: async () => ({ id: 'mock-scan-id' })
  },
  user: {
    findMany: async () => [],
    findFirst: async () => null,
    count: async () => 0,
    create: async () => ({ id: 'mock-user-id' }),
    update: async () => ({ id: 'mock-user-id' })
  }
}