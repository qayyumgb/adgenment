import { PrismaClient } from "@prisma/client";

/**
 * In development we cache the client on `globalThis` to survive hot reloads
 * (tsx watch / nodemon would otherwise leak a new connection pool on every
 * file change). In production we always construct a fresh client.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makeClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required. Set it in your .env or platform variables."
    );
  }
  return new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
    log:
      process.env.NODE_ENV === "production"
        ? ["error"]
        : ["query", "error", "warn"],
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
