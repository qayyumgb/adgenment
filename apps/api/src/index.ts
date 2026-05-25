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
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";

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
    origin: WEB_ORIGIN,
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

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "0.1.0",
  });
});

// Global rate limit — 100 req / 15 min per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

// Stricter limit for AI endpoints — 20 req / 15 min per IP
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI rate limit exceeded. Try again later." },
});

app.use("/api", globalLimiter);
app.use("/api/ai", aiLimiter);
app.use("/api", router);

app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`[adgenius-api] listening on http://localhost:${PORT}`);
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`[adgenius-api] ${signal} received — shutting down…`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log("[adgenius-api] prisma disconnected — bye");
      process.exit(0);
    } catch (err) {
      console.error("[adgenius-api] shutdown error:", err);
      process.exit(1);
    }
  });

  // Force-exit after 10s if close hangs
  setTimeout(() => {
    console.warn("[adgenius-api] forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
