import PgBoss from "pg-boss";

/**
 * Background jobs (plan C10) on pg-boss. The queue lives in the app's own
 * Postgres (schema "pgboss", created on first start), so there's no extra
 * service to run or pay for.
 *
 * - A scheduled job runs once per tick across every API instance, never once
 *   per instance, and never twice at the same time (policy "stately").
 * - A failed job retries with backoff; one cut off by a deploy (or stuck past
 *   its expiry) is retried too.
 * - Work queues (one sync per account) run a few jobs at once per instance.
 *
 * If the queue can't start, or JOB_QUEUE=off, the API falls back to the
 * in-process timers it used before C10, so nothing stops running.
 */

export type Recurring = {
  name: string;
  /** When it runs: cron, in UTC. */
  cron: string;
  /** False when its *_ENABLED variable turns it off: neither the job nor the timer runs. */
  enabled: boolean;
  run: () => Promise<unknown>;
  /** The in-process timer used when the queue isn't available. */
  timer: () => void;
  /** A run longer than this counts as stuck: it fails and is retried. */
  expireInMinutes?: number;
};

export type WorkQueue<T extends object> = {
  name: string;
  /** Jobs from this queue that run at the same time, per API instance. */
  concurrency: number;
  run: (data: T) => Promise<unknown>;
  retryLimit: number;
  retryDelaySeconds: number;
  expireInMinutes: number;
};

/** The Postgres schema pg-boss keeps its tables in. */
const schema = () => process.env.JOB_QUEUE_SCHEMA || "pgboss";
let boss: PgBoss | null = null;

/** True when jobs go through the queue; false when the in-process timers run instead. */
export const queueRunning = () => boss !== null;

/**
 * Add a job to a work queue. `key` keeps one waiting job per key (a second
 * send while one waits returns null). Returns null when the queue isn't
 * running, so callers can do the work inline instead.
 */
export async function enqueue(name: string, data: object, key?: string): Promise<string | null> {
  if (!boss) return null;
  return boss.send(name, data, key ? { singletonKey: key } : {});
}

/**
 * Keys with a job waiting, retrying or running in a queue. Callers skip those:
 * a second job for a busy key would sit at the head of the queue and hold up
 * the jobs behind it until the first one finishes.
 */
export async function pendingKeys(name: string): Promise<Set<string>> {
  if (!boss) return new Set();
  const { rows } = await boss.getDb().executeSql(`SELECT singleton_key FROM ${schema()}.job WHERE name = $1 AND state < 'completed' AND singleton_key IS NOT NULL`, [name]);
  return new Set(rows.map((r: { singleton_key: string }) => r.singleton_key));
}

async function ensureQueue(b: PgBoss, name: string, options: Omit<PgBoss.Queue, "name">) {
  if (await b.getQueue(name)) return b.updateQueue(name, { name, ...options });
  // Two instances starting together may race to create it; the loser updates instead.
  await b.createQueue(name, { name, ...options }).catch(() => b.updateQueue(name, { name, ...options }));
}

/** Start the queue (or the fallback timers). Call once, after Prisma connects. */
export async function startJobs(recurring: Recurring[], queues: WorkQueue<any>[]): Promise<"queue" | "timers"> {
  const fallback = () => {
    for (const r of recurring) if (r.enabled) r.timer();
    return "timers" as const;
  };
  if ((process.env.JOB_QUEUE ?? "on").toLowerCase() === "off" || !process.env.DATABASE_URL) {
    console.log("[jobs] queue off (JOB_QUEUE=off): using in-process timers");
    return fallback();
  }

  const b = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    schema: schema(),
    application_name: "advertix-jobs",
    max: Number(process.env.JOB_QUEUE_POOL) || 4,
  });
  b.on("error", (err) => console.error("[jobs]", err instanceof Error ? err.message : err));
  try {
    await b.start();
    for (const r of recurring) {
      if (!r.enabled) {
        await b.unschedule(r.name);
        continue;
      }
      await ensureQueue(b, r.name, { policy: "stately", retryLimit: 2, retryDelay: 60, retryBackoff: true, expireInSeconds: (r.expireInMinutes ?? 30) * 60 });
      await b.schedule(r.name, r.cron);
      await b.work(r.name, { pollingIntervalSeconds: 15 }, async () => {
        await r.run();
      });
    }
    for (const q of queues) {
      await ensureQueue(b, q.name, { policy: "stately", retryLimit: q.retryLimit, retryDelay: q.retryDelaySeconds, retryBackoff: true, expireInSeconds: q.expireInMinutes * 60 });
      for (let i = 0; i < q.concurrency; i++) {
        await b.work<object>(q.name, { pollingIntervalSeconds: 10 }, async ([job]) => {
          await q.run(job.data);
        });
      }
    }
    boss = b;
    console.log(`[jobs] queue started: ${recurring.filter((r) => r.enabled).length} scheduled jobs, ${queues.length} work queues`);
    return "queue";
  } catch (err) {
    console.error("[jobs] queue unavailable, using in-process timers:", err instanceof Error ? err.message : err);
    await b.stop({ graceful: false }).catch(() => undefined);
    return fallback();
  }
}

/** Graceful shutdown: let running jobs finish for a few seconds; anything cut off is retried after the deploy. */
export async function stopJobs(timeoutMs = 8_000): Promise<void> {
  const b = boss;
  boss = null;
  if (b) await b.stop({ graceful: true, timeout: timeoutMs }).catch((err) => console.error("[jobs] stop:", err instanceof Error ? err.message : err));
}
