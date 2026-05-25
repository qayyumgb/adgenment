import { Router, type Request, type Response, type NextFunction } from "express";
import {
  Prisma,
  type CreativeType,
  type CreativeStatus,
  type Platform,
} from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { requireWorkspace } from "../lib/workspace";

const router = Router();
router.use(requireAuth);

const CREATIVE_TYPES: ReadonlyArray<CreativeType> = [
  "IMAGE",
  "VIDEO",
  "CAROUSEL",
  "TEXT",
];
const CREATIVE_STATUSES: ReadonlyArray<CreativeStatus> = [
  "DRAFT",
  "APPROVED",
  "REJECTED",
  "ARCHIVED",
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

function isCreativeType(v: unknown): v is CreativeType {
  return typeof v === "string" && CREATIVE_TYPES.includes(v as CreativeType);
}
function isCreativeStatus(v: unknown): v is CreativeStatus {
  return (
    typeof v === "string" && CREATIVE_STATUSES.includes(v as CreativeStatus)
  );
}
function isPlatform(v: unknown): v is Platform {
  return typeof v === "string" && PLATFORMS.includes(v as Platform);
}

/**
 * GET /creatives
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const { type, status, search, platform } = req.query;
    const page = Math.max(
      1,
      parseInt(String(req.query.page ?? "1"), 10) || 1
    );
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit ?? "12"), 10) || 12)
    );

    const where: Prisma.CreativeWhereInput = { workspaceId: workspace.id };
    if (isCreativeType(type)) where.type = type;
    if (isCreativeStatus(status)) where.status = status;
    if (typeof search === "string" && search.trim() !== "") {
      where.name = { contains: search.trim(), mode: "insensitive" };
    }
    if (isPlatform(platform)) {
      where.campaign = { platform };
    }

    const [total, creatives] = await Promise.all([
      prisma.creative.count({ where }),
      prisma.creative.findMany({
        where,
        include: {
          campaign: { select: { name: true, platform: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.json({
      creatives,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /creatives
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const { name, type, content, campaignId, aiGenerated, status } =
      req.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    if (!isCreativeType(type)) {
      return res.status(400).json({ error: "Invalid or missing type" });
    }
    if (content === undefined || content === null) {
      return res.status(400).json({ error: "content is required" });
    }

    if (typeof campaignId === "string" && campaignId.trim()) {
      const c = await prisma.campaign.findFirst({
        where: { id: campaignId, workspaceId: workspace.id },
        select: { id: true },
      });
      if (!c) {
        return res
          .status(404)
          .json({ error: "Campaign not found in this workspace" });
      }
    }

    const creative = await prisma.creative.create({
      data: {
        workspaceId: workspace.id,
        name: name.trim(),
        type,
        content: content as Prisma.InputJsonValue,
        campaignId:
          typeof campaignId === "string" && campaignId.trim()
            ? campaignId
            : null,
        aiGenerated: aiGenerated === true,
        status: isCreativeStatus(status) ? status : "DRAFT",
      },
    });
    res.status(201).json(creative);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /creatives/:id
 */
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const existing = await prisma.creative.findFirst({
      where: { id: req.params.id, workspaceId: workspace.id },
    });
    if (!existing) {
      return res.status(404).json({ error: "Creative not found" });
    }

    const { name, content, status } = req.body ?? {};
    const data: Prisma.CreativeUpdateInput = {};
    if (typeof name === "string" && name.trim()) data.name = name.trim();
    if (content !== undefined) {
      data.content = content as Prisma.InputJsonValue;
    }
    if (isCreativeStatus(status)) data.status = status;

    const updated = await prisma.creative.update({
      where: { id: existing.id },
      data,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /creatives/:id
 */
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const existing = await prisma.creative.findFirst({
        where: { id: req.params.id, workspaceId: workspace.id },
      });
      if (!existing) {
        return res.status(404).json({ error: "Creative not found" });
      }
      await prisma.creative.delete({ where: { id: existing.id } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
