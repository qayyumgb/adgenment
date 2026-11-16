/**
 * Manual check of the whole render job against the local database and file
 * storage (plan C20a): takes the most recently edited real design, renders
 * it with a simple motion added to every layer, checks the stored files,
 * then deletes the test render and its files.
 *   npx tsx scripts/video-job-test.ts [designId]
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { readAsset, deleteAssets } from "../src/services/assets.service";
import { runVideoRender } from "../src/services/video-render.service";

async function main() {
  const d = process.argv[2]
    ? await prisma.design.findUnique({ where: { id: process.argv[2] } })
    : await prisma.design.findFirst({ where: { kept: true }, orderBy: { updatedAt: "desc" } });
  if (!d) return console.log("No saved design in the local database: make one in the editor first.");
  const data = JSON.parse(JSON.stringify(d.data)) as { objects?: Record<string, unknown>[]; motion?: unknown };
  const kinds = ["fade", "slide-up", "pop", "zoom-in", "slide-right", "typewriter"];
  (data.objects ?? []).forEach((o, i) => {
    const text = typeof o.text === "string";
    o.anim = { in: i === 0 ? "fade" : text ? kinds[i % kinds.length] : kinds[i % 5], at: Math.min(3, i * 0.25), dur: 0.6 };
  });
  data.motion = { duration: 5 };
  console.log(`design "${d.name}" ${d.width}x${d.height}, ${(data.objects ?? []).length} layers`);

  const r = await prisma.videoRender.create({ data: { workspaceId: d.workspaceId, designId: d.id, revision: d.revision, width: d.width, height: d.height, data: data as object } });
  await runVideoRender({ renderId: r.id });
  const done = await prisma.videoRender.findUniqueOrThrow({ where: { id: r.id } });
  console.log("status:", done.status, "| progress:", done.progress, "| duration ms:", done.durationMs, "| error:", done.error, "| snapshot cleared:", done.data === null);
  if (done.assetId && done.posterAssetId) {
    const v = await readAsset(done.assetId);
    const p = await readAsset(done.posterAssetId);
    console.log("video:", v?.asset.mime, v?.asset.kind, `${((v?.body.length ?? 0) / 1024).toFixed(0)} KB`, "| mp4 header:", v?.body.subarray(4, 8).toString());
    console.log("poster:", p?.asset.mime, p?.asset.kind, `${p?.asset.width}x${p?.asset.height}`);
    if (process.env.KEEP) {
      const fs = await import("fs");
      const os = await import("os");
      const path = await import("path");
      fs.writeFileSync(path.join(os.tmpdir(), "job-test.mp4"), v!.body);
      fs.writeFileSync(path.join(os.tmpdir(), "job-test-poster.webp"), p!.body);
    }
    await deleteAssets({ id: { in: [done.assetId, done.posterAssetId] } });
  }
  await prisma.videoRender.delete({ where: { id: r.id } });
  console.log("test render and its files removed");
}
main()
  .catch((e) => (console.error(e), (process.exitCode = 1)))
  .finally(() => prisma.$disconnect());
