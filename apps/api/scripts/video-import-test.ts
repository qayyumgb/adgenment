/**
 * C20b check: a video from the Creatives library goes into a design as a clip,
 * and the design lists it under "Your videos". Uses the local database and
 * file storage with a temporary design and creative; removes them after.
 *
 *   npx tsx scripts/video-import-test.ts
 */
import "dotenv/config";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { prisma } from "../src/lib/prisma";
import type { Access } from "../src/lib/access";
import { createFileAsset, deleteAssets } from "../src/services/assets.service";
import { importCreativeClip, listClips } from "../src/services/clips.service";
import { getDesign } from "../src/services/designs.service";
import { runFfmpeg } from "../src/services/video/ffmpeg";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${detail ? `  (${detail})` : ""}`);
};

async function main() {
  const member = await prisma.workspaceMember.findFirst({ where: { role: "OWNER" }, include: { workspace: true } });
  if (!member) throw new Error("No workspace owner in the local database.");
  const ws = member.workspace;
  const access = { workspaceId: ws.id, plan: ws.plan, billing: ws, memberId: member.id, role: "OWNER", clientIds: null } as unknown as Access;
  const base = "http://localhost:4000";

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "advertix-import-"));
  const file = path.join(dir, "made.mp4");
  // A video "made in the editor": 4 s, no sound (as the renderer writes one without clips).
  const made = await runFfmpeg(["-y", "-f", "lavfi", "-i", "testsrc2=size=1080x1080:rate=30:duration=4", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", file]);
  if (made.code !== 0) throw new Error(made.log.slice(-300));
  const bytes = await fs.readFile(file);
  await fs.rm(dir, { recursive: true, force: true });

  const source = await prisma.design.create({ data: { workspaceId: ws.id, name: "import-test source", width: 1080, height: 1080, data: {}, createdById: member.userId, kept: true } });
  const target = await prisma.design.create({ data: { workspaceId: ws.id, name: "import-test target", width: 1080, height: 1920, data: {}, createdById: member.userId, kept: true } });
  const creatives: string[] = [];
  try {
    const asset = await createFileAsset({ workspaceId: ws.id, designId: source.id, createdById: member.userId, kind: "video", body: bytes, mime: "video/mp4", ext: "mp4", width: 1080, height: 1080, durationMs: 4000 });
    const editorVideo = await prisma.creative.create({ data: { workspaceId: ws.id, name: "import-test video", type: "VIDEO", status: "DRAFT", content: { designId: source.id, videoAssetId: asset.id, assetId: asset.id } } });
    const empty = await prisma.creative.create({ data: { workspaceId: ws.id, name: "import-test empty", type: "VIDEO", status: "DRAFT", content: {} } });
    const image = await prisma.creative.create({ data: { workspaceId: ws.id, name: "import-test image", type: "IMAGE", status: "DRAFT", content: {} } });
    creatives.push(editorVideo.id, empty.id, image.id);

    const clip = await importCreativeClip(access, member.userId, base, target.id, editorVideo.id);
    check("a video made in the editor comes in as a clip", Math.abs(clip.durationMs - 4000) < 150 && clip.width === 1080, `${clip.durationMs} ms, ${clip.width}x${clip.height}`);
    check("the clip was prepared (a sound track added to a silent video)", clip.hasAudio === false);
    const listed = await listClips(base, target.id);
    check("it is listed with the design's videos", listed.length === 1 && listed[0].id === clip.id && listed[0].durationMs === clip.durationMs);
    const doc = await getDesign(access, base, target.id);
    check("the design sent to the editor includes it", doc.clips.length === 1 && doc.clips[0].url.includes(clip.id));
    check("the source file is untouched (a copy was made)", Boolean(await prisma.asset.findUnique({ where: { id: asset.id } })) && clip.id !== asset.id);

    const expect = async (name: string, id: string, status: number) => {
      try {
        await importCreativeClip(access, member.userId, base, target.id, id);
        check(name, false, "was accepted");
      } catch (e) {
        check(name, (e as { status?: number }).status === status, (e as Error).message.slice(0, 90));
      }
    };
    await expect("a video creative with no file is refused clearly", empty.id, 409);
    await expect("an image creative is refused", image.id, 400);
    await expect("a creative that doesn't exist is refused", "nope", 404);
  } finally {
    await deleteAssets({ designId: source.id });
    await deleteAssets({ designId: target.id });
    await prisma.creative.deleteMany({ where: { id: { in: creatives } } });
    await prisma.design.deleteMany({ where: { id: { in: [source.id, target.id] } } });
  }
  console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
  if (failed) process.exitCode = 1;
}
main()
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
