import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, (_req: Request, res: Response) => {
  res.json({ campaigns: [] });
});

router.post("/", requireAuth, (req: Request, res: Response) => {
  res.status(201).json({ campaign: { id: "new", ...req.body } });
});

router.get("/:id", requireAuth, (req: Request, res: Response) => {
  res.json({ campaign: { id: req.params.id } });
});

router.put("/:id", requireAuth, (req: Request, res: Response) => {
  res.json({ campaign: { id: req.params.id, ...req.body } });
});

router.delete("/:id", requireAuth, (req: Request, res: Response) => {
  res.status(204).send();
});

export default router;
