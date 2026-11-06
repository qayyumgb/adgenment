import { promises as fs } from "fs";
import path from "path";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * File storage for the creative editor (plan C19): Cloudflare R2 through its
 * S3-compatible API. The bucket stays private; the API serves files through
 * signed links (services/assets.service.ts).
 *
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *
 * Without them, development keeps files in apps/api/.storage (never in
 * production, where uploads answer "File storage isn't set up").
 */

const r2On = () => Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
const localOn = () => !r2On() && process.env.NODE_ENV !== "production";
export const storageConfigured = () => r2On() || localOn();

/** The account id, also when the whole endpoint URL was pasted ("https://<id>.r2.cloudflarestorage.com"). */
export function r2AccountId(raw = process.env.R2_ACCOUNT_ID ?? "") {
  const v = raw.trim();
  return v.match(/[0-9a-f]{32}/i)?.[0] ?? v.replace(/^https?:\/\//, "").split(/[./]/)[0];
}

let client: S3Client | null = null;
function r2() {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${r2AccountId()}.r2.cloudflarestorage.com`,
      // Bucket in the path, not the host name (no per-bucket DNS).
      forcePathStyle: true,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
    });
  }
  return client;
}
const bucket = () => process.env.R2_BUCKET!;
const LOCAL_DIR = path.resolve(__dirname, "../../.storage");
const localPath = (key: string) => {
  const p = path.resolve(LOCAL_DIR, key);
  if (!p.startsWith(LOCAL_DIR)) throw new Error("Invalid storage key");
  return p;
};

function unavailable() {
  return Object.assign(new Error("File storage isn't set up on this server yet (R2)."), { status: 503 });
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  if (r2On()) {
    await r2().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType, CacheControl: "private, max-age=31536000, immutable" }));
    return;
  }
  if (!localOn()) throw unavailable();
  await fs.mkdir(path.dirname(localPath(key)), { recursive: true });
  await fs.writeFile(localPath(key), body);
}

export async function getObject(key: string): Promise<Buffer | null> {
  if (r2On()) {
    try {
      const r = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
      return r.Body ? Buffer.from(await r.Body.transformToByteArray()) : null;
    } catch (err) {
      if ((err as { name?: string }).name === "NoSuchKey") return null;
      throw err;
    }
  }
  if (!localOn()) throw unavailable();
  return fs.readFile(localPath(key)).catch(() => null);
}

/** Delete objects (missing ones are fine). */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (!keys.length) return;
  if (r2On()) {
    for (let i = 0; i < keys.length; i += 1000) {
      await r2().send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true } }));
    }
    return;
  }
  if (!localOn()) return;
  await Promise.all(keys.map((k) => fs.rm(localPath(k), { force: true })));
}

/** Delete everything under a prefix (a whole workspace's folder). */
export async function deletePrefix(prefix: string): Promise<number> {
  if (r2On()) {
    let deleted = 0;
    let token: string | undefined;
    do {
      const page = await r2().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }));
      const keys = (page.Contents ?? []).map((o) => o.Key!).filter(Boolean);
      await deleteObjects(keys);
      deleted += keys.length;
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return deleted;
  }
  if (!localOn()) return 0;
  await fs.rm(localPath(prefix), { recursive: true, force: true });
  return 0;
}
