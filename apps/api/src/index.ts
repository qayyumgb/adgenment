import "dotenv/config";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import router from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { prisma } from "./lib/prisma";
import {
  startSyncScheduler,
  stopSyncScheduler,
} from "./services/sync-scheduler.service";
import { startNotificationScheduler } from "./services/notifications.service";
import { startApprovalScheduler } from "./services/approvals.service";
import { startSafetyScheduler } from "./services/safety.service";
import { startHoursScheduler } from "./services/hours.service";
import { startAlertsScheduler } from "./services/alerts.service";
import { startReportScheduler } from "./services/reports.service";
import { handleWebhook } from "./services/billing.service";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const NODE_ENV = process.env.NODE_ENV ?? "development";

// Allowed browser origins. Production callers MUST be enumerated by exact
// scheme + host. Wildcards are intentionally not supported.
// - CORS_ORIGIN (preferred, comma-separated)
// - WEB_ORIGIN (legacy single value)
// - Falls back to localhost for `npm run dev`.
const allowedOrigins: string[] = (() => {
  const fromEnv = process.env.CORS_ORIGIN ?? process.env.WEB_ORIGIN;
  if (fromEnv) {
    return fromEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return ["http://localhost:3000"];
})();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    // `same-origin` (Helmet default) severs `window.opener` when an OAuth
    // popup transitions through our API. `same-origin-allow-popups` keeps
    // the relationship intact so the popup can postMessage back to its
    // opener after Meta/Google/etc. redirects.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Server-to-server / curl / health checks send no Origin header — allow.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

// Stripe webhooks (C11) need the raw body to check the signature, so this
// route comes before the JSON parser. Stripe authenticates it, not Clerk.
app.post("/api/billing/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req: Request, res: Response) => {
  try {
    res.json(await handleWebhook(req.body as Buffer, req.headers["stripe-signature"] as string | undefined));
  } catch (err) {
    const e = err as Error & { status?: number };
    console.error("[billing] webhook:", e.message);
    // 4xx tells Stripe the event is bad (no retry); 5xx makes it retry.
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logging — single line per request
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`
    );
  });
  next();
});

// Health check — Railway and most uptime probes will hit /health
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    app: "Advertix API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Global rate limit — generous because authenticated dashboard apps fire
// many parallel reads per page (auth/me, campaigns, counts, sidebar, etc).
// A typical /campaigns visit costs ~9 requests; clicking around for a minute
// can easily hit 50+. 2000 / 15min (~2 req/sec sustained) leaves plenty of
// headroom while still rate-limiting abusive clients.
//
// Counted per signed-in user, not per IP: an agency's whole team usually
// shares one office IP and would otherwise lock each other out. The user id
// is read from the session token unverified (it only picks the bucket;
// requireAuth verifies it), so a per-IP ceiling below stops anyone from
// dodging the limit by inventing tokens.
const tokenSubject = (req: express.Request): string | null => {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  const part = h.slice(7).split(".")[1];
  if (!part) return null;
  try {
    const sub = JSON.parse(Buffer.from(part, "base64url").toString("utf8")).sub;
    return typeof sub === "string" && sub.length < 100 ? sub : null;
  } catch {
    return null;
  }
};
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const sub = tokenSubject(req);
    return sub ? `user:${sub}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;
  },
  message: { error: "Too many requests. Please slow down." },
});
const ipCeiling = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  standardHeaders: false,
  legacyHeaders: false,
  message: { error: "Too many requests from this network. Try again in a few minutes." },
});

// Stricter limit for AI endpoints — actual Claude calls are expensive in
// both latency and $$. 60 / 15min ≈ 4 per minute per IP is plenty for a
// human-driven flow; a runaway frontend loop is caught quickly.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI rate limit exceeded. Try again later." },
});

// Client portal links (C4) are public: a tighter limit makes guessing tokens
// pointless (they are 32 random bytes anyway) and caps scraping.
const portalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again in a few minutes." },
});

app.use("/api", ipCeiling);
app.use("/api", globalLimiter);
app.use("/api/ai", aiLimiter);
app.use("/api/portal", portalLimiter);
app.use("/api", router);

app.use(errorHandler);

async function startServer() {
  try {
    await prisma.$connect();
    console.log("[advertix-api] database connected");

    const server = app.listen(PORT, () => {
      console.log(
        `[advertix-api] listening on http://localhost:${PORT} (${NODE_ENV})`
      );
      console.log(
        `[advertix-api] CORS allowed origins: ${allowedOrigins.join(", ")}`
      );
    });

    // Periodic platform sync so dashboards stay current without manual action.
    startSyncScheduler();
    // Hourly email alerts (A14); nothing is sent without RESEND_API_KEY.
    startNotificationScheduler();
    startApprovalScheduler();
    // Safety rules (C14) and auto-apply (C13): only for clients that opted in.
    startSafetyScheduler();
    startHoursScheduler();
    // Alerts inbox (C2): recomputed hourly from stored data.
    startAlertsScheduler();
    // Scheduled client reports (C4b): 09:00 workspace time, weekly or monthly.
    startReportScheduler();

    // Graceful shutdown — Railway sends SIGTERM during redeploy
    const shutdown = (signal: string) => {
      console.log(`[advertix-api] ${signal} received — shutting down…`);
      stopSyncScheduler();
      server.close(async () => {
        try {
          await prisma.$disconnect();
          console.log("[advertix-api] prisma disconnected — bye");
          process.exit(0);
        } catch (err) {
          console.error("[advertix-api] shutdown error:", err);
          process.exit(1);
        }
      });

      // Force-exit after 10s if close hangs
      setTimeout(() => {
        console.warn("[advertix-api] forced shutdown after timeout");
        process.exit(1);
      }, 10_000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    console.error("[advertix-api] failed to start:", err);
    process.exit(1);
  }
}

void startServer();

export default app;
