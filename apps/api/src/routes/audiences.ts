import { Router, type Request, type Response, type NextFunction } from "express";
import { Prisma, type AudienceType, type Platform } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { requireWorkspace } from "../lib/workspace";

const router = Router();
router.use(requireAuth);

const AUDIENCE_TYPES: ReadonlyArray<AudienceType> = [
  "LOOKALIKE",
  "INTEREST",
  "RETARGETING",
  "CUSTOM",
  "BEHAVIORAL",
  "SAVED",
];
const PLATFORMS: ReadonlyArray<Platform> = [
  "META",
  "GOOGLE",
  "TIKTOK",
  "LINKEDIN",
  "YOUTUBE",
  "SNAPCHAT",
  "PINTEREST",
  "X",
];

function isAudienceType(v: unknown): v is AudienceType {
  return typeof v === "string" && AUDIENCE_TYPES.includes(v as AudienceType);
}

/** Coerce an incoming platforms value to a valid Platform[]; defaults to META. */
function normalizePlatforms(v: unknown): Platform[] {
  if (Array.isArray(v)) {
    const valid = v.filter((p): p is Platform =>
      PLATFORMS.includes(p as Platform)
    );
    if (valid.length > 0) return Array.from(new Set(valid));
  }
  return ["META"];
}

/**
 * `targeting` must be a non-null object (the MetaTargeting spec). We don't
 * deep-validate the spec here — Meta is the source of truth at publish time —
 * but we reject obviously wrong shapes (missing, array, primitive).
 */
function isTargetingObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Clamp an optional approxSize to a non-negative int, or null. */
function normalizeApproxSize(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return Math.round(v);
  }
  return null;
}

/**
 * GET /audiences — list this workspace's saved targeting templates.
 * Filters: `type`, `search` (name contains). Paginated.
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const { type, search } = req.query;
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit ?? "48"), 10) || 48)
    );

    const where: Prisma.AudienceWhereInput = { workspaceId: workspace.id };
    if (isAudienceType(type)) where.type = type;
    if (typeof search === "string" && search.trim() !== "") {
      where.name = { contains: search.trim(), mode: "insensitive" };
    }

    const [total, audiences] = await Promise.all([
      prisma.audience.count({ where }),
      prisma.audience.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.json({
      audiences,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /audiences — create a saved targeting template.
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const { name, description, type, platforms, targeting, aiGenerated, approxSize } =
      req.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    if (!isTargetingObject(targeting)) {
      return res
        .status(400)
        .json({ error: "targeting is required (a targeting spec object)" });
    }

    const audience = await prisma.audience.create({
      data: {
        workspaceId: workspace.id,
        name: name.trim(),
        description:
          typeof description === "string" && description.trim()
            ? description.trim()
            : null,
        type: isAudienceType(type) ? type : "SAVED",
        platforms: normalizePlatforms(platforms),
        targeting: targeting as Prisma.InputJsonValue,
        aiGenerated: aiGenerated === true,
        approxSize: normalizeApproxSize(approxSize),
      },
    });
    res.status(201).json(audience);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /audiences/:id — update a saved targeting template (workspace-scoped).
 */
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const existing = await prisma.audience.findFirst({
      where: { id: req.params.id, workspaceId: workspace.id },
    });
    if (!existing) {
      return res.status(404).json({ error: "Audience not found" });
    }

    const { name, description, type, platforms, targeting, approxSize } =
      req.body ?? {};
    const data: Prisma.AudienceUpdateInput = {};
    if (typeof name === "string" && name.trim()) data.name = name.trim();
    if (typeof description === "string") {
      data.description = description.trim() || null;
    }
    if (isAudienceType(type)) data.type = type;
    if (Array.isArray(platforms)) data.platforms = normalizePlatforms(platforms);
    if (isTargetingObject(targeting)) {
      data.targeting = targeting as Prisma.InputJsonValue;
    }
    if (approxSize !== undefined) data.approxSize = normalizeApproxSize(approxSize);

    const updated = await prisma.audience.update({
      where: { id: existing.id },
      data,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /audiences/:id
 */
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const existing = await prisma.audience.findFirst({
        where: { id: req.params.id, workspaceId: workspace.id },
      });
      if (!existing) {
        return res.status(404).json({ error: "Audience not found" });
      }
      await prisma.audience.delete({ where: { id: existing.id } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /audiences/:id/duplicate — clone an audience as "<name> (copy)".
 */
router.post(
  "/:id/duplicate",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const source = await prisma.audience.findFirst({
        where: { id: req.params.id, workspaceId: workspace.id },
      });
      if (!source) {
        return res.status(404).json({ error: "Audience not found" });
      }
      const copy = await prisma.audience.create({
        data: {
          workspaceId: workspace.id,
          name: `${source.name} (copy)`,
          description: source.description,
          type: source.type,
          platforms: source.platforms,
          targeting: source.targeting as Prisma.InputJsonValue,
          aiGenerated: source.aiGenerated,
          approxSize: source.approxSize,
        },
      });
      res.status(201).json(copy);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
