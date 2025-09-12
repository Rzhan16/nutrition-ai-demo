import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Only create Prisma client if DATABASE_URL is available
let prisma: PrismaClient | undefined

if (process.env.DATABASE_URL) {
  prisma = globalForPrisma.prisma ?? new PrismaClient()
  
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
  
  // Connection pooling configuration (only in runtime, not during build)
  if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
    prisma.$connect().catch((error) => {
      console.error('Failed to connect to database:', error)
      // Don't exit during build process
      if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PHASE !== 'phase-production-build') {
        console.warn('Database connection failed, but continuing...')
      }
    })
  }
  
  // Graceful shutdown
  process.on('beforeExit', async () => {
    if (prisma) {
      await prisma.$disconnect()
    }
  })
}

export { prisma }
export default prisma