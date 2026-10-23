/**
 * One-off role migration for plan B6 (decision 7): OWNER / ADMIN / EDITOR /
 * VIEWER → OWNER / MEDIA_BUYER / ANALYST / CLIENT_VIEWER.
 *
 * Run after `prisma db push` has added the new values (or before: it adds
 * them itself). The old values stay in the enum, unused, so nothing is dropped:
 *
 *   npx prisma db push
 *   npx tsx --env-file=.env scripts/migrate-roles.ts
 *
 * Safe to run more than once.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ADD VALUE can't run inside a transaction, so each statement goes on its own.
  for (const v of ["MEDIA_BUYER", "ANALYST", "CLIENT_VIEWER"]) {
    await prisma.$executeRawUnsafe(`ALTER TYPE "WorkspaceRole" ADD VALUE IF NOT EXISTS '${v}'`);
  }
  const buyers = await prisma.$executeRawUnsafe(`UPDATE "WorkspaceMember" SET "role" = 'MEDIA_BUYER' WHERE "role"::text IN ('ADMIN', 'EDITOR')`);
  const analysts = await prisma.$executeRawUnsafe(`UPDATE "WorkspaceMember" SET "role" = 'ANALYST' WHERE "role"::text = 'VIEWER'`);
  console.log(`Roles migrated: ${buyers} admin/editor → MEDIA_BUYER, ${analysts} viewer → ANALYST.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
