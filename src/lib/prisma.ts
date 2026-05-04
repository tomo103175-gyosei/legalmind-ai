import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// Vercel UI cache bug bypass: dynamically convert old IPv6 URL to IPv4 pooler URL
let runtimeDbUrl = process.env.SUPABASE_POOLER_URL || process.env.DATABASE_URL || '';

if (runtimeDbUrl.includes('db.jubtousqadhsnvjngtjh.supabase.co:5432')) {
  // Extract password from old URL, fallback to known encoded password if regex fails
  const match = runtimeDbUrl.match(/postgres:(.*?)@/);
  const pwd = match ? match[1] : 'iv53b%2F%266QPT94nF';
  runtimeDbUrl = `postgresql://postgres.jubtousqadhsnvjngtjh:${pwd}@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`;
}

export const prisma = globalForPrisma.prisma || new PrismaClient({
  datasources: {
    db: {
      url: runtimeDbUrl,
    },
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
