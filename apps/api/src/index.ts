import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import router from "./routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";

app.use(
  cors({
    origin: WEB_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "adgenius-api",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", router);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[adgenius-api] listening on http://localhost:${PORT}`);
});

export default app;
