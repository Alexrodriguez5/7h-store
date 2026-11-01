import { PrismaClient } from "@prisma/client";
import { runtimeDatabaseUrl } from "./db-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const url = runtimeDatabaseUrl(process.env.DATABASE_URL);
export const prisma = globalForPrisma.prisma ?? new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
