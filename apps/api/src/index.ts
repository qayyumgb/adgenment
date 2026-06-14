import "dotenv/config";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { prisma } from "./lib/prisma";

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
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
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

app.use("/api", globalLimiter);
app.use("/api/ai", aiLimiter);
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

    // Graceful shutdown — Railway sends SIGTERM during redeploy
    const shutdown = (signal: string) => {
      console.log(`[advertix-api] ${signal} received — shutting down…`);
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
