import { spawn } from "child_process";

/**
 * ffmpeg for video ads (plan C20): where the program is, running it, and
 * reading what a file contains. No canvas code here, so an instance that
 * only takes uploads never loads the drawing library.
 */

export const ffmpegPath = () => {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bundled = require("ffmpeg-static") as string | null;
    if (bundled) return bundled;
  } catch {
    /* not installed: the system's ffmpeg */
  }
  return "ffmpeg";
};

/** Run ffmpeg to the end. Resolves with its exit code and what it printed (the last 6000 characters). */
export function runFfmpeg(args: string[], timeoutMs = 10 * 60_000): Promise<{ code: number | null; log: string }> {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath(), ["-hide_banner", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let log = "";
    ff.stderr.on("data", (d: Buffer) => (log = (log + d.toString()).slice(-6000)));
    const timer = setTimeout(() => ff.kill("SIGKILL"), timeoutMs);
    ff.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`Couldn't start ffmpeg: ${e.message}`));
    });
    ff.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, log });
    });
  });
}

export type Probe = { durationMs: number; width: number; height: number; hasAudio: boolean };

/**
 * What a media file contains, read from ffmpeg's own description of it (there
 * is no ffprobe in the bundled build). Null when it has no video.
 * Width and height are as stored: a phone video filmed upright may be stored
 * sideways with a rotation note, so only trust them for files we wrote.
 */
export async function probe(file: string): Promise<Probe | null> {
  // With no output file ffmpeg prints the description and stops with an error code: expected.
  const { log } = await runFfmpeg(["-i", file], 60_000);
  const d = /Duration: (\d+):(\d\d):(\d\d(?:\.\d+)?)/.exec(log);
  const v = /Stream #\d+:\d+[^\n]*: Video: [^\n]*?[ ,](\d{2,5})x(\d{2,5})[ ,\n\[]/.exec(log);
  if (!v) return null;
  const durationMs = d ? Math.round((Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3])) * 1000) : 0;
  return { durationMs, width: Number(v[1]), height: Number(v[2]), hasAudio: /Stream #\d+:\d+[^\n]*: Audio: /.test(log) };
}
