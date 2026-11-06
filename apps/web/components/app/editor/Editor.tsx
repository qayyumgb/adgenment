"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Canvas, FabricImage, FabricObject, Textbox, util, type Point, type Rect } from "fabric";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bold,
  BringToFront,
  Copy,
  Download,
  Eye,
  EyeOff,
  FlipHorizontal,
  Heading1,
  Image as ImageIcon,
  ImageOff,
  Images,
  Italic,
  List,
  Lock,
  MoreHorizontal,
  Move,
  Redo2,
  SendToBack,
  Smartphone,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Undo2,
  Unlock,
  Wallpaper,
} from "lucide-react";
import { useApiClient, type Creative, type DesignDoc } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/cn";
import { Button, Dialog, IconButton, Menu, MenuItem, Skeleton, useConfirm } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";
import { DEFAULT_FONT, FONTS, addFontStylesheet, loadFont } from "./fonts";
import { alignTo, dataUrlToBlob, fitScale, fontsIn, hydrate, isLocked, layerName, serialize, setLocked, snap, type Align, type Guides } from "./canvas";
import { FRAME_SHAPES, SHAPES, ShapeIcon, makeShape, type ShapeKind } from "./shapes";
import { FrameImage, isFrame, makeFrame } from "./frames";
import { ColorPicker } from "./ColorPicker";

/**
 * Creative editor (plan C19a): finish ads in the three Meta sizes. Images,
 * text, shapes and a background on a Fabric.js canvas; layers, undo / redo,
 * snapping, keyboard shortcuts and the Stories / Reels safe zone. Drafts save
 * on their own; "Save to Creatives" exports the PNG (stored in R2, sent to
 * Meta when connected) for the wizard, A/B tests and publishing.
 */

const SIZES = [
  { width: 1080, height: 1080, label: "Square 1:1", sub: "Feed" },
  { width: 1200, height: 628, label: "Landscape 1.91:1", sub: "Link ads" },
  { width: 1080, height: 1920, label: "Vertical 9:16", sub: "Stories, Reels" },
];
// Meta keeps the top ~14% and bottom ~20% of Stories / Reels for its own buttons and captions.
const SAFE_TOP = 0.14;
const SAFE_BOTTOM = 0.2;
const SWATCHES = ["#ffffff", "#111827", "#6448f2", "#0ea5e9", "#16a34a", "#f59e0b", "#ef4444", "#f3f4f6", "#1e3a8a", "#fde68a"];
const HISTORY_MAX = 60;

type Obj = FabricObject & { name?: string; assetId?: string; locked?: boolean };
type TextObj = Textbox & { name?: string };
type Status = "saved" | "dirty" | "saving" | "error" | "conflict";

const field = "h-8 rounded-ctl border border-line-2 bg-surface px-2 text-[13px] text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft";

function ToolButton({ label, active, onClick, children, disabled }: { label: string; active?: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn("inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40", active && "bg-brand-soft text-brand-ink")}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-line px-4 py-4 last:border-b-0">
      <h2 className="m-0 text-xs font-semibold uppercase tracking-[.06em] text-ink-3">{title}</h2>
      {children}
    </section>
  );
}

function PanelButton({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex items-center gap-2.5 rounded-ctl border border-line bg-surface px-3 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:border-brand hover:bg-brand-soft disabled:opacity-50">
      <span className="text-ink-2">{icon}</span>
      {label}
    </button>
  );
}

/** Pick an image from the Creatives library. */
function LibraryPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (c: Creative) => void }) {
  const q = useApi((c) => (open ? c.getCreatives({ type: "IMAGE", limit: 60 }) : new Promise<never>(() => {})), [open], { key: "editor-library" });
  const list = (q.data?.creatives ?? []).filter((c) => {
    const x = (c.content ?? {}) as Record<string, unknown>;
    return typeof x.imageUrl === "string" || typeof x.url === "string" || typeof x.dataUrl === "string" || typeof x.assetId === "string";
  });
  const src = (c: Creative) => {
    const x = (c.content ?? {}) as Record<string, unknown>;
    return (x.dataUrl ?? x.imageUrl ?? x.url) as string | undefined;
  };
  return (
    <Dialog open={open} onClose={onClose} title="Add from Creatives" sub="Images in your library. A copy goes into this design." width={720} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {q.loading && !q.data ? (
        <Skeleton className="h-48 rounded-card" />
      ) : list.length === 0 ? (
        <p className="m-0 text-sm text-ink-2">No images in Creatives yet. Upload one with Upload image instead.</p>
      ) : (
        <div className="grid max-h-[60vh] grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5 overflow-y-auto">
          {list.map((c) => (
            <button key={c.id} type="button" onClick={() => onPick(c)} className="group flex flex-col gap-1 rounded-ctl border border-line p-1.5 text-left hover:border-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(c)} alt="" className="aspect-square w-full rounded-md bg-surface-2 object-cover" loading="lazy" />
              <span className="truncate text-xs text-ink-2 group-hover:text-ink">{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
}

export default function Editor({ designId }: { designId: string }) {
  const api = useApiClient();
  const router = useRouter();
  const params = useSearchParams();
  const canEdit = useAccess().can("edit");
  const { confirm, dialog } = useConfirm();

  const rootRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const guidesRef = useRef("");
  // Frames: the one an image is being dragged over, and the one whose photo is being repositioned.
  const hoverFrame = useRef<FrameImage | null>(null);
  const adjustRef = useRef<FrameImage | null>(null);
  const panFrom = useRef<Point | null>(null);
  const elRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const history = useRef<{ stack: string[]; at: number; quiet: boolean }>({ stack: [], at: -1, quiet: true });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The revision this editor's copy is based on (a save from an older copy is refused).
  const revisionRef = useRef(0);

  const [doc, setDoc] = useState<DesignDoc | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [size, setSize] = useState({ width: 1080, height: 1080 });
  const [zoom, setZoom] = useState(0.5);
  const [selected, setSelected] = useState<Obj | null>(null);
  const [, setRev] = useState(0);
  const [layers, setLayers] = useState<Obj[]>([]);
  const [guides, setGuides] = useState<Guides>({ v: [], h: [] });
  const [status, setStatusState] = useState<Status>("saved");
  const statusRef = useRef<Status>("saved");
  // Once changed elsewhere, stay in that state until reload (no saving over the other copy).
  const setStatus = (s: Status) => {
    if (statusRef.current === "conflict" && s !== "conflict") return;
    statusRef.current = s;
    setStatusState(s);
  };
  const [busy, setBusy] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [safeZone, setSafeZone] = useState(true);
  const [narrow, setNarrow] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // The editor fills the window below whatever sits above it (top bar, banners), so the page never scrolls.
  const [height, setHeight] = useState<number | null>(null);
  const [manualSave, setManualSave] = useState(false);
  const [adjusting, setAdjusting] = useState<FrameImage | null>(null);

  const bump = () => setRev((r) => r + 1);
  const W = size.width;
  const H = size.height;
  const vertical = H > W;

  /* ── load ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    addFontStylesheet();
    const mq = () => setNarrow(window.innerWidth < 900);
    mq();
    window.addEventListener("resize", mq);
    let alive = true;
    api
      .getDesign(designId)
      .then((d) => {
        if (!alive) return;
        setDoc(d);
        revisionRef.current = d.revision ?? 0;
        setName(d.name);
        setSize({ width: d.width, height: d.height });
      })
      .catch((err) => alive && setLoadError(err instanceof Error ? err.message : "This design didn't load."));
    return () => {
      alive = false;
      window.removeEventListener("resize", mq);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designId]);

  const refreshLayers = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    setLayers([...(c.getObjects() as Obj[])].reverse());
  }, []);

  const save = useCallback(
    async (opts: { preview?: boolean; quiet?: boolean } = {}) => {
      const c = canvasRef.current;
      if (!c || !canEdit || statusRef.current === "conflict") return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setStatus("saving");
      try {
        const saved = await api.saveDesign(designId, { data: serialize(c), name: name.trim() || "Untitled design", width: W, height: H, revision: revisionRef.current });
        revisionRef.current = saved.revision;
        if (opts.preview) {
          c.discardActiveObject();
          c.requestRenderAll();
          const url = c.toDataURL({ format: "png", multiplier: 480 / (W * c.getZoom()), enableRetinaScaling: false });
          await api.saveDesignPreview(designId, await dataUrlToBlob(url));
        }
        setStatus("saved");
        if (!opts.quiet) toast.success("Draft saved");
      } catch (err) {
        // Changed in another tab or by a teammate: stop saving over it, and say so once.
        if ((err as { status?: number }).status === 409) {
          setStatus("conflict");
          toast.error("This design was changed in another tab or by a teammate. Reload to get the latest; changes made here since then weren't saved.", { duration: 9000, id: "design-conflict" });
          return;
        }
        setStatus("error");
        if (!opts.quiet) toast.error(err instanceof Error ? err.message : "Couldn't save the draft.");
      }
    },
    [api, canEdit, designId, name, W, H]
  );

  /** Remember the canvas for undo, and save a few seconds later. */
  const record = useCallback(() => {
    const c = canvasRef.current;
    const h = history.current;
    if (!c || h.quiet) return;
    const snapshot = JSON.stringify(serialize(c));
    if (h.stack[h.at] === snapshot) return;
    h.stack = h.stack.slice(0, h.at + 1);
    h.stack.push(snapshot);
    if (h.stack.length > HISTORY_MAX) h.stack.shift();
    h.at = h.stack.length - 1;
    setCanUndo(h.at > 0);
    setCanRedo(false);
    refreshLayers();
    if (!canEdit) return;
    setStatus("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveRef.current({ quiet: true }), 2500);
  }, [canEdit, refreshLayers]);
  const saveRef = useRef(save);
  saveRef.current = save;
  const recordRef = useRef(record);
  recordRef.current = record;

  /** Load JSON into the canvas (fonts first, so text measures right). */
  const loadJson = useCallback(async (json: Record<string, unknown>) => {
    const c = canvasRef.current;
    if (!c) return;
    history.current.quiet = true;
    await Promise.all(fontsIn(json).map((f) => loadFont(f.family, f.weight, f.italic)));
    await c.loadFromJSON(json);
    c.getObjects().forEach((o) => {
      if (o instanceof Textbox) o.initDimensions();
      if (isLocked(o)) setLocked(o, true);
    });
    c.requestRenderAll();
    history.current.quiet = false;
    refreshLayers();
  }, [refreshLayers]);

  /* ── canvas ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!doc || !elRef.current || canvasRef.current) return;
    const c = new Canvas(elRef.current, { preserveObjectStacking: true, backgroundColor: "#ffffff", selectionColor: "rgba(100,72,242,0.08)", selectionBorderColor: "#6448f2", selectionLineWidth: 1 });
    canvasRef.current = c;
    const onSel = () => {
      setSelected((c.getActiveObject() as Obj) ?? null);
      bump();
    };
    c.on("selection:created", onSel);
    c.on("selection:updated", onSel);
    c.on("selection:cleared", () => {
      setSelected(null);
      stopAdjustRef.current();
    });
    c.on("object:modified", (e) => {
      guidesRef.current = "";
      setGuides({ v: [], h: [] });
      const target = e.target as FabricObject | undefined;
      // A frame's resize goes into its box (the photo re-fills it, never stretched).
      if (isFrame(target)) target.bakeScale();
      // An image dropped on a frame goes into the frame.
      const into = hoverFrame.current;
      if (into && target instanceof FabricImage && !isFrame(target)) {
        hoverFrame.current = null;
        into.hover = false;
        const assetId = (target as Obj).assetId;
        if (assetId) {
          into.setPhoto(target.getElement() as HTMLImageElement, assetId);
          history.current.quiet = true;
          c.remove(target);
          history.current.quiet = false;
          c.setActiveObject(into);
        }
        c.requestRenderAll();
      }
      recordRef.current();
      bump();
    });
    c.on("mouse:dblclick", (e) => {
      if (isFrame(e.target) && !e.target.empty) startAdjustRef.current(e.target);
    });
    // Repositioning a photo inside its frame: drag moves the photo, not the frame.
    c.on("mouse:down", (e) => {
      if (adjustRef.current && e.target === adjustRef.current) panFrom.current = c.getScenePoint(e.e);
      else if (adjustRef.current && e.target !== adjustRef.current) stopAdjustRef.current();
    });
    c.on("mouse:move", (e) => {
      const fr = adjustRef.current;
      if (!fr || !panFrom.current) return;
      const p = c.getScenePoint(e.e);
      fr.pan(p.x - panFrom.current.x, p.y - panFrom.current.y);
      panFrom.current = p;
      c.requestRenderAll();
    });
    c.on("object:added", () => recordRef.current());
    c.on("object:removed", () => recordRef.current());
    c.on("text:changed", () => {
      bump();
      refreshLayers();
    });
    c.on("text:editing:exited", () => recordRef.current());
    // Snap while dragging; re-render only when the guides change, not on every mouse move.
    const showGuides = (g: Guides) => {
      const key = `${g.v.join(",")}|${g.h.join(",")}`;
      if (key === guidesRef.current) return;
      guidesRef.current = key;
      setGuides(g);
    };
    c.on("object:moving", (e) => {
      const z = c.getZoom();
      const target = e.target as FabricObject;
      // Dragging an image over a frame: highlight the frame it would go into.
      if (target instanceof FabricImage && !isFrame(target)) {
        const p = c.getScenePoint(e.e);
        const under = (c.getObjects().filter((o) => isFrame(o) && o !== target && o.visible !== false) as unknown as FrameImage[]).reverse().find((fr) => fr.containsPoint(p)) ?? null;
        if (under !== hoverFrame.current) {
          if (hoverFrame.current) hoverFrame.current.hover = false;
          if (under) under.hover = true;
          hoverFrame.current = under;
          c.requestRenderAll();
        }
        if (under) return showGuides({ v: [], h: [] });
      }
      showGuides(snap(target, c.getWidth() / z, c.getHeight() / z, 8 / z));
    });
    c.on("mouse:up", () => {
      showGuides({ v: [], h: [] });
      if (panFrom.current) {
        panFrom.current = null;
        recordRef.current();
      }
    });

    void (async () => {
      const json = hydrate((doc.data ?? {}) as Record<string, unknown>, doc.assets);
      if (Array.isArray(json.objects) && json.objects.length) await loadJson(json);
      else {
        if (typeof json.background === "string") c.backgroundColor = json.background;
        history.current.quiet = false;
      }
      history.current.stack = [JSON.stringify(serialize(c))];
      history.current.at = 0;
      refreshLayers();
      // Opened from a library image ("Open in editor"): place it as the background.
      const from = params.get("import");
      if (from && c.getObjects().length === 0) await addFromCreative(from, "background");
    })();
    return () => {
      void c.dispose();
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  // Fit the design in the space available.
  useEffect(() => {
    const el = wrapRef.current;
    const c = canvasRef.current;
    if (!el || !doc) return;
    const fit = () => {
      const z = Math.min((el.clientWidth - 64) / W, (el.clientHeight - 64) / H, 1);
      const zz = Math.max(0.05, z);
      setZoom(zz);
      if (c) {
        c.setDimensions({ width: Math.round(W * zz), height: Math.round(H * zz) });
        c.setZoom(zz);
        c.requestRenderAll();
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc, W, H, narrow]);

  // Fill the window from the editor's top edge down (banners above may come and go).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      setHeight((h) => {
        const next = Math.max(520, Math.floor(window.innerHeight - top));
        return h === next ? h : next;
      });
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    if (el.parentElement?.parentElement) ro.observe(el.parentElement.parentElement);
    return () => {
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [narrow, loadError]);

  // Leaving with unsaved changes.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  /* ── actions ─────────────────────────────────────────────────────────── */
  const c = () => canvasRef.current!;
  const add = (o: FabricObject, select = true) => {
    c().add(o);
    if (select) c().setActiveObject(o);
    c().requestRenderAll();
  };

  const addText = async (kind: "heading" | "subheading" | "body") => {
    const preset = {
      heading: { text: "Your headline", size: 0.085, weight: 800, family: "Poppins", name: "Heading" },
      subheading: { text: "A short line that explains the offer", size: 0.045, weight: 600, family: DEFAULT_FONT, name: "Subheading" },
      body: { text: "Add more details here", size: 0.032, weight: 400, family: DEFAULT_FONT, name: "Text" },
    }[kind];
    await loadFont(preset.family, preset.weight);
    add(new Textbox(preset.text, { left: W / 2, top: H * (kind === "heading" ? 0.3 : kind === "subheading" ? 0.45 : 0.55), width: W * 0.8, fontSize: Math.round(Math.min(W, H) * preset.size * (W > H ? 1.3 : 1)), fontWeight: preset.weight, fontFamily: preset.family, fill: "#111827", textAlign: "center", lineHeight: 1.15, name: preset.name } as Partial<Textbox>));
  };

  const addShape = (kind: ShapeKind) => {
    const s = Math.min(W, H);
    const [w, h] =
      kind === "rect" ? [s * 0.45, s * 0.3] : kind === "rounded" ? [s * 0.45, s * 0.12] : kind === "oval" ? [s * 0.4, s * 0.26] : kind === "arrow" || kind === "slanted" ? [s * 0.45, s * 0.2] : kind === "line" ? [s * 0.5, 0] : kind === "diagonal" ? [s * 0.4, s * 0.4] : kind === "arch" ? [s * 0.3, s * 0.4] : [s * 0.3, s * 0.3];
    const o = makeShape(kind, w, h);
    o.set({ left: W / 2, top: H / 2 });
    add(o);
  };

  /** A new empty frame: drop or add a photo into it. */
  const addFrame = (kind: ShapeKind) => {
    const s = Math.min(W, H);
    const [w, h] = kind === "oval" || kind === "slanted" || kind === "rect" || kind === "rounded" || kind === "arrow" ? [s * 0.55, s * 0.38] : kind === "arch" ? [s * 0.38, s * 0.52] : [s * 0.42, s * 0.42];
    const fr = makeFrame(kind, w, h);
    fr.set({ left: W / 2, top: H / 2 });
    add(fr);
  };

  /** Drop a file from the computer: into the frame under the pointer, or as a new image there. */
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = Array.from(e.dataTransfer.files ?? []).find((x) => x.type.startsWith("image/"));
    const cv = canvasRef.current;
    if (!file || !cv || !canEdit) return;
    const p = cv.getScenePoint(e.nativeEvent as unknown as MouseEvent);
    const under = (cv.getObjects().filter((o) => isFrame(o) && o.visible !== false) as unknown as FrameImage[]).reverse().find((fr) => fr.containsPoint(p));
    setBusy("upload");
    try {
      const img = await api.uploadDesignImage(designId, file);
      if (under) await fillFrame(under, img);
      else {
        cv.discardActiveObject();
        await placeImage(img, "image", { x: p.x, y: p.y });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add the image.");
    } finally {
      setBusy(null);
    }
  };

  /** Reposition the photo inside a frame (double-click it, or Adjust image). */
  const startAdjust = (fr: FrameImage) => {
    adjustRef.current = fr;
    fr.set({ lockMovementX: true, lockMovementY: true, hasControls: false, hoverCursor: "move" } as Partial<FrameImage>);
    c().setActiveObject(fr);
    c().requestRenderAll();
    setAdjusting(fr);
  };
  const stopAdjust = () => {
    const fr = adjustRef.current;
    if (!fr) return;
    adjustRef.current = null;
    panFrom.current = null;
    if (isLocked(fr)) setLocked(fr, true);
    else fr.set({ lockMovementX: false, lockMovementY: false, hasControls: true, hoverCursor: null } as Partial<FrameImage>);
    canvasRef.current?.requestRenderAll();
    setAdjusting(null);
  };
  const startAdjustRef = useRef(startAdjust);
  startAdjustRef.current = startAdjust;
  const stopAdjustRef = useRef(stopAdjust);
  stopAdjustRef.current = stopAdjust;

  /** Take a legacy crop off an image (designs saved before frames). */
  const removeCrop = () => {
    const o = c().getActiveObject() as FabricImage | undefined;
    if (!o) return;
    o.clipPath = undefined;
    o.set({ dirty: true });
    c().requestRenderAll();
    recordRef.current();
    bump();
  };

  /** Put a stored image into a frame (the photo covers it). */
  const fillFrame = async (fr: FrameImage, img: { id: string; url: string }) => {
    const el = await util.loadImage(img.url, { crossOrigin: "anonymous" });
    fr.setPhoto(el, img.id);
    c().setActiveObject(fr);
    c().requestRenderAll();
    recordRef.current();
    bump();
  };

  /** Put a stored image on the canvas: in the selected frame, fitted in the middle (or at a point), or as a background. */
  const placeImage = async (img: { id: string; url: string }, mode: "image" | "background", at?: { x: number; y: number }) => {
    const active = c().getActiveObject();
    if (mode === "image" && isFrame(active)) return fillFrame(active, img);
    const fi = await FabricImage.fromURL(img.url, { crossOrigin: "anonymous" });
    const iw = fi.width ?? 1;
    const ih = fi.height ?? 1;
    const scale = mode === "background" ? fitScale(iw, ih, W, H, "cover") : fitScale(iw, ih, W * 0.6, H * 0.6, "contain");
    fi.set({ left: at?.x ?? W / 2, top: at?.y ?? H / 2, scaleX: scale, scaleY: scale, assetId: img.id, name: mode === "background" ? "Background" : "Image" } as Partial<FabricImage>);
    if (mode === "background") {
      c().getObjects().filter((o) => (o as Obj).name === "Background").forEach((o) => c().remove(o));
      setLocked(fi, true);
      c().add(fi);
      c().sendObjectToBack(fi);
      c().discardActiveObject();
      c().requestRenderAll();
    } else add(fi);
  };

  const upload = async (file: File | undefined, mode: "image" | "background") => {
    if (!file) return;
    setBusy("upload");
    try {
      await placeImage(await api.uploadDesignImage(designId, file), mode);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add the image.");
    } finally {
      setBusy(null);
    }
  };

  const addFromCreative = async (creativeId: string, mode: "image" | "background" = "image") => {
    setPicker(false);
    setBusy("upload");
    try {
      await placeImage(await api.importDesignImage(designId, creativeId), mode);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that image.");
    } finally {
      setBusy(null);
    }
  };

  /** `final` false while dragging in the colour picker: preview only, one undo step when it's let go. */
  const setBackgroundColor = (color: string, final = true) => {
    c().backgroundColor = color;
    c().requestRenderAll();
    if (!final) return;
    recordRef.current();
    bump();
  };

  const change = (props: Record<string, unknown>, final = true) => {
    const o = c().getActiveObject();
    if (!o) return;
    o.set(props);
    if (o instanceof Textbox) o.initDimensions();
    o.setCoords();
    c().requestRenderAll();
    if (!final) return;
    recordRef.current();
    bump();
  };

  const setFont = async (family: string) => {
    const o = c().getActiveObject() as TextObj | undefined;
    if (!o) return;
    await loadFont(family, o.fontWeight ?? 400, o.fontStyle === "italic");
    change({ fontFamily: family });
  };

  const toggleBullets = () => {
    const o = c().getActiveObject() as TextObj | undefined;
    if (!o) return;
    const lines = (o.text ?? "").split("\n");
    const on = lines.every((l) => l.startsWith("• "));
    change({ text: lines.map((l) => (on ? l.replace(/^• /, "") : `• ${l.replace(/^• /, "")}`)).join("\n") });
  };

  const toggleCase = () => {
    const o = c().getActiveObject() as TextObj | undefined;
    if (!o) return;
    const t = o.text ?? "";
    change({ text: t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[.!?]\s+|\n)(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase()) : t.toUpperCase() });
  };

  const removeSelected = () => {
    const sel = c().getActiveObjects();
    if (!sel.length) return;
    c().discardActiveObject();
    sel.forEach((o) => c().remove(o));
    c().requestRenderAll();
  };

  const duplicate = async () => {
    const o = c().getActiveObject() as Obj | undefined;
    if (!o || o.type?.toLowerCase() === "activeselection") return;
    const copy = (await o.clone(["assetId", "name", "locked"])) as Obj;
    copy.set({ left: (o.left ?? 0) + 24, top: (o.top ?? 0) + 24 });
    if (isLocked(copy)) setLocked(copy, false);
    add(copy);
  };

  const toggleLock = (o: Obj | null = selected) => {
    if (!o) return;
    setLocked(o, !isLocked(o));
    c().requestRenderAll();
    recordRef.current();
    bump();
  };

  const toggleVisible = (o: Obj) => {
    o.set({ visible: !o.visible });
    if (!o.visible && c().getActiveObject() === o) c().discardActiveObject();
    c().requestRenderAll();
    recordRef.current();
    bump();
  };

  const order = (dir: "up" | "down" | "front" | "back", o: Obj | null = selected) => {
    if (!o) return;
    if (dir === "up") c().bringObjectForward(o);
    if (dir === "down") c().sendObjectBackwards(o);
    if (dir === "front") c().bringObjectToFront(o);
    if (dir === "back") c().sendObjectToBack(o);
    c().requestRenderAll();
    recordRef.current();
  };

  const align = (a: Align) => {
    const o = c().getActiveObject();
    if (!o) return;
    alignTo(o, a, W, H);
    c().requestRenderAll();
    recordRef.current();
  };

  const nudge = (dx: number, dy: number) => {
    const o = c().getActiveObject();
    if (!o || isLocked(o)) return;
    o.set({ left: (o.left ?? 0) + dx, top: (o.top ?? 0) + dy });
    o.setCoords();
    c().requestRenderAll();
    recordRef.current();
  };

  const step = async (dir: -1 | 1) => {
    const h = history.current;
    const to = h.at + dir;
    if (to < 0 || to >= h.stack.length) return;
    h.at = to;
    c().discardActiveObject();
    await loadJson(JSON.parse(h.stack[to]));
    setCanUndo(h.at > 0);
    setCanRedo(h.at < h.stack.length - 1);
    setSelected(null);
    setStatus("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveRef.current({ quiet: true }), 2500);
  };

  const changeSize = async (w: number, h: number) => {
    if (w === W && h === H) return;
    setSize({ width: w, height: h });
    toast("Size changed. Layers keep their place; move them to fit the new shape.", { icon: "↔️" });
    setStatus("dirty");
    setTimeout(() => void saveRef.current({ quiet: true }), 300);
  };

  const exportPng = () => {
    c().discardActiveObject();
    c().requestRenderAll();
    return c().toDataURL({ format: "png", multiplier: 1 / c().getZoom(), enableRetinaScaling: false });
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = exportPng();
    a.download = `${(name.trim() || "design").replace(/[^\w-]+/g, "-")}-${W}x${H}.png`;
    a.click();
  };

  const toCreatives = async () => {
    setBusy("export");
    try {
      await save({ quiet: true });
      const r = await api.exportDesign(designId, await dataUrlToBlob(exportPng()));
      if (r.metaUploaded) toast.success("Saved to Creatives, and uploaded to Meta: ready to publish.");
      else if (r.metaError) toast(`Saved to Creatives. Meta didn't take the image yet (${r.metaError}); it uploads when you publish.`, { icon: "⚠️", duration: 7000 });
      else toast.success("Saved to Creatives.");
      setDoc((d) => (d ? { ...d, creativeId: r.creativeId } : d));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save to Creatives.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: "Delete this design?", body: doc?.creativeId ? "The design, its ad in Creatives and its images are deleted. Ads already running on Meta aren't affected." : "The design and its images are deleted.", confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.deleteDesign(designId);
      toast.success("Design deleted");
      router.push("/creatives");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete it.");
    }
  };

  /* ── keyboard ────────────────────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const cv = canvasRef.current;
      if (!cv) return;
      const editing = (cv.getActiveObject() as Textbox | undefined)?.isEditing;
      if (editing) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        void step(e.shiftKey ? 1 : -1);
      } else if (mod && k === "y") {
        e.preventDefault();
        void step(1);
      } else if (mod && k === "d") {
        e.preventDefault();
        void duplicate();
      } else if (mod && k === "s") {
        e.preventDefault();
        void save({ preview: true });
      } else if (k === "delete" || k === "backspace") {
        if (cv.getActiveObject()) {
          e.preventDefault();
          removeSelected();
        }
      } else if (k === "escape") {
        if (adjustRef.current) return stopAdjust();
        cv.discardActiveObject();
        cv.requestRenderAll();
      } else if (k.startsWith("arrow")) {
        if (!cv.getActiveObject()) return;
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        nudge(k === "arrowleft" ? -d : k === "arrowright" ? d : 0, k === "arrowup" ? -d : k === "arrowdown" ? d : 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ── render ──────────────────────────────────────────────────────────── */
  const sel = selected;
  const kind = sel?.type?.toLowerCase() ?? "";
  const isText = kind === "textbox" || kind === "i-text" || kind === "text";
  const isImage = kind === "image";
  const fr = isFrame(sel) ? sel : null;
  const isShape = ["rect", "circle", "ellipse", "line", "polygon", "path", "triangle"].includes(kind);
  const t = sel as TextObj | null;
  const statusText = useMemo(() => ({ saved: "All changes saved", dirty: "Unsaved changes", saving: "Saving…", error: "Not saved: try again", conflict: "Changed elsewhere: reload" })[status], [status]);
  const bgColor = typeof canvasRef.current?.backgroundColor === "string" ? (canvasRef.current.backgroundColor as string) : "#ffffff";

  if (narrow) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <Smartphone size={28} className="text-ink-3" aria-hidden="true" />
        <h1 className="m-0 text-lg font-semibold">Open on a computer to edit</h1>
        <p className="m-0 max-w-[360px] text-sm text-ink-2">The ad editor needs a bigger screen. Your design is saved and waiting.</p>
        <Link href="/creatives" className="text-sm font-semibold text-brand no-underline">
          Back to Creatives
        </Link>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <h1 className="m-0 text-lg font-semibold">This design didn&apos;t load</h1>
        <p className="m-0 text-sm text-ink-2">{loadError}</p>
        <Link href="/creatives" className="text-sm font-semibold text-brand no-underline">
          Back to Creatives
        </Link>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="flex min-h-[520px] flex-col overflow-hidden" style={{ height: height ?? "calc(100vh - 64px)" }}>
      {/* Top bar: one line, fixed height (nothing in it may change the canvas size) */}
      <div className="flex h-[52px] flex-none items-center gap-2 overflow-hidden border-b border-line bg-surface px-3">
        <Link href="/creatives" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label="Back to Creatives">
          <ArrowLeft size={18} />
        </Link>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => doc && name.trim() !== doc.name && void save({ quiet: true })}
          aria-label="Design name"
          maxLength={120}
          disabled={!canEdit}
          className="h-8 w-[clamp(120px,16vw,240px)] min-w-0 rounded-ctl border border-transparent bg-transparent px-2 text-[15px] font-semibold text-ink outline-none hover:border-line focus:border-brand"
        />
        <select value={`${W}x${H}`} onChange={(e) => void changeSize(Number(e.target.value.split("x")[0]), Number(e.target.value.split("x")[1]))} aria-label="Ad size" disabled={!canEdit} className={field}>
          {SIZES.map((s) => (
            <option key={`${s.width}x${s.height}`} value={`${s.width}x${s.height}`}>
              {s.label} · {s.width}×{s.height}
            </option>
          ))}
        </select>
        <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
        <ToolButton label="Undo (Ctrl+Z)" onClick={() => void step(-1)} disabled={!canUndo}>
          <Undo2 size={16} />
        </ToolButton>
        <ToolButton label="Redo (Ctrl+Shift+Z)" onClick={() => void step(1)} disabled={!canRedo}>
          <Redo2 size={16} />
        </ToolButton>
        {vertical && (
          <ToolButton label="Show Stories and Reels safe zone" active={safeZone} onClick={() => setSafeZone((v) => !v)}>
            <Smartphone size={16} />
          </ToolButton>
        )}
        <span className="w-10 text-xs tabular-nums text-ink-3">{Math.round(zoom * 100)}%</span>
        <span className="min-w-0 flex-1" />
        {status === "conflict" && (
          <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
            Reload
          </Button>
        )}
        <span className={cn("hidden w-[118px] truncate text-right text-xs min-[1200px]:inline", status === "error" || status === "conflict" ? "text-neg" : "text-ink-3")} aria-live="polite" title={canEdit ? statusText : "View only"}>
          {canEdit ? statusText : "View only"}
        </span>
        <IconButton label="Download PNG" size={32} onClick={download} disabled={!doc}>
          <Download size={16} />
        </IconButton>
        {canEdit && (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                setManualSave(true);
                await save({ preview: true });
                setManualSave(false);
              }}
              loading={manualSave}
              disabled={!doc}
            >
              Save draft
            </Button>
            <Button variant="primary" size="sm" onClick={() => void toCreatives()} loading={busy === "export"} disabled={!doc}>
              Save to Creatives
            </Button>
            <Menu align="end" width={200} trigger={(p) => <IconButton {...p} label="More" size={32}><MoreHorizontal size={16} /></IconButton>}>
              {(close) => (
                <MenuItem icon={<Trash2 size={15} />} onSelect={() => (close(), void remove())}>
                  Delete design
                </MenuItem>
              )}
            </Menu>
          </>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left: add */}
        <aside className="w-[232px] flex-none overflow-y-auto border-r border-line bg-surface" aria-label="Add to the design">
          <Section title="Text">
            <PanelButton icon={<Heading1 size={16} />} label="Add a heading" onClick={() => void addText("heading")} disabled={!doc || !canEdit} />
            <PanelButton icon={<Type size={16} />} label="Add a subheading" onClick={() => void addText("subheading")} disabled={!doc || !canEdit} />
            <PanelButton icon={<Type size={14} />} label="Add body text" onClick={() => void addText("body")} disabled={!doc || !canEdit} />
          </Section>
          <Section title="Images">
            <PanelButton icon={<ImageIcon size={16} />} label={busy === "upload" ? "Adding…" : "Upload image"} onClick={() => fileRef.current?.click()} disabled={!doc || !canEdit || busy === "upload"} />
            <PanelButton icon={<Images size={16} />} label="From Creatives" onClick={() => setPicker(true)} disabled={!doc || !canEdit || busy === "upload"} />
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { void upload(e.target.files?.[0], "image"); e.target.value = ""; }} />
          </Section>
          <Section title="Shapes">
            <div className="grid grid-cols-5 gap-1">
              {SHAPES.map((s) => (
                <ToolButton key={s.kind} label={s.label} onClick={() => addShape(s.kind)} disabled={!doc || !canEdit}>
                  <ShapeIcon kind={s.kind} size={20} />
                </ToolButton>
              ))}
            </div>
          </Section>
          <Section title="Frames">
            <div className="grid grid-cols-5 gap-1">
              {FRAME_SHAPES.map((s) => (
                <ToolButton key={s.kind} label={`${s.label} frame`} onClick={() => addFrame(s.kind)} disabled={!doc || !canEdit}>
                  <span className="relative inline-flex">
                    <ShapeIcon kind={s.kind} size={20} />
                    <ImageIcon size={9} className="absolute -bottom-0.5 -right-1 rounded-sm bg-surface text-ink-2" aria-hidden="true" />
                  </span>
                </ToolButton>
              ))}
            </div>
            <p className="m-0 text-[11px] text-ink-3">Add a frame, then drag an image onto it (or drop a file). Resizing the frame never squashes the photo; double-click to move the photo inside.</p>
          </Section>
          <Section title="Background">
            <div className="flex flex-wrap gap-1.5">
              {SWATCHES.map((s) => (
                <button key={s} type="button" aria-label={`Background ${s}`} onClick={() => setBackgroundColor(s)} disabled={!doc || !canEdit} className={cn("h-7 w-7 rounded-full border border-line-2", bgColor.toLowerCase() === s && "ring-2 ring-brand ring-offset-1")} style={{ background: s }} />
              ))}
              <ColorPicker value={bgColor} label="Background colour (any colour and opacity)" onChange={setBackgroundColor} disabled={!doc || !canEdit} />
            </div>
            <PanelButton icon={<Wallpaper size={16} />} label="Background image" onClick={() => bgFileRef.current?.click()} disabled={!doc || !canEdit || busy === "upload"} />
            <input ref={bgFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { void upload(e.target.files?.[0], "background"); e.target.value = ""; }} />
          </Section>
        </aside>

        {/* Centre: toolbar + canvas */}
        <div className="flex min-w-0 flex-1 flex-col bg-bg">
          <div className="flex h-[48px] flex-none items-center gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b border-line bg-surface px-3 [scrollbar-width:thin]" role="toolbar" aria-label="Selected layer">
            {!sel ? (
              <span className="px-1 text-xs text-ink-3">Select a layer to edit it. Drag to move; corners resize; the top handle rotates.</span>
            ) : (
              <>
                {isText && t && (
                  <>
                    <select value={t.fontFamily as string} onChange={(e) => void setFont(e.target.value)} aria-label="Font" className={cn(field, "w-[150px]")}>
                      {FONTS.map((f) => (
                        <option key={f.family} value={f.family}>
                          {f.family}
                        </option>
                      ))}
                    </select>
                    <input type="number" min={8} max={600} value={Math.round(t.fontSize ?? 40)} onChange={(e) => change({ fontSize: Math.max(8, Math.min(600, Number(e.target.value) || 8)) })} aria-label="Font size" className={cn(field, "w-[64px] tabular-nums")} />
                    <ColorPicker value={typeof t.fill === "string" ? t.fill : "#111827"} label="Text colour" onChange={(col, final) => change({ fill: col }, final)} />
                    <ToolButton label="Bold" active={Number(t.fontWeight) >= 600 || t.fontWeight === "bold"} onClick={async () => { const next = Number(t.fontWeight) >= 600 || t.fontWeight === "bold" ? 400 : 700; await loadFont(t.fontFamily as string, next, t.fontStyle === "italic"); change({ fontWeight: next }); }}><Bold size={15} /></ToolButton>
                    <ToolButton label="Italic" active={t.fontStyle === "italic"} onClick={async () => { await loadFont(t.fontFamily as string, t.fontWeight ?? 400, t.fontStyle !== "italic"); change({ fontStyle: t.fontStyle === "italic" ? "normal" : "italic" }); }}><Italic size={15} /></ToolButton>
                    <ToolButton label="Underline" active={Boolean(t.underline)} onClick={() => change({ underline: !t.underline })}><Underline size={15} /></ToolButton>
                    <ToolButton label="Strikethrough" active={Boolean(t.linethrough)} onClick={() => change({ linethrough: !t.linethrough })}><Strikethrough size={15} /></ToolButton>
                    <ToolButton label="Upper / sentence case" onClick={toggleCase}><span className="text-[12px] font-semibold">Aa</span></ToolButton>
                    <ToolButton label="Align left" active={t.textAlign === "left"} onClick={() => change({ textAlign: "left" })}><AlignLeft size={15} /></ToolButton>
                    <ToolButton label="Align centre" active={t.textAlign === "center"} onClick={() => change({ textAlign: "center" })}><AlignCenter size={15} /></ToolButton>
                    <ToolButton label="Align right" active={t.textAlign === "right"} onClick={() => change({ textAlign: "right" })}><AlignRight size={15} /></ToolButton>
                    <ToolButton label="Bullet list" active={(t.text ?? "").split("\n").every((l) => l.startsWith("• "))} onClick={toggleBullets}><List size={15} /></ToolButton>
                    <label className="flex items-center gap-1 px-1 text-[11px] text-ink-3" title="Letter spacing">
                      Spacing
                      <input type="range" min={-50} max={400} step={10} value={t.charSpacing ?? 0} onChange={(e) => change({ charSpacing: Number(e.target.value) })} className="w-[70px] accent-[#6448f2]" aria-label="Letter spacing" />
                    </label>
                    <label className="flex items-center gap-1 px-1 text-[11px] text-ink-3" title="Line height">
                      Lines
                      <input type="range" min={0.8} max={2.4} step={0.05} value={t.lineHeight ?? 1.16} onChange={(e) => change({ lineHeight: Number(e.target.value) })} className="w-[70px] accent-[#6448f2]" aria-label="Line height" />
                    </label>
                  </>
                )}
                {isShape && (
                  <>
                    {kind !== "line" && (
                      <ColorPicker value={typeof sel.fill === "string" ? sel.fill : "#6448f2"} label="Fill colour" onChange={(col, final) => change({ fill: col }, final)} />
                    )}
                    <ColorPicker kind="outline" value={typeof sel.stroke === "string" ? sel.stroke : ""} label="Outline colour" onChange={(col, final) => change({ stroke: col, strokeWidth: sel.strokeWidth || 4 }, final)} />
                    <input type="number" min={0} max={80} value={Math.round(sel.strokeWidth ?? 0)} onChange={(e) => change({ strokeWidth: Math.max(0, Number(e.target.value) || 0) })} aria-label="Outline width" title="Outline width" className={cn(field, "w-[56px] tabular-nums")} />
                    {kind === "rect" && (
                      <label className="flex items-center gap-1 px-1 text-[11px] text-ink-3" title="Corner radius">
                        Corners
                        <input type="range" min={0} max={Math.round(Math.min((sel as Rect).width ?? 100, (sel as Rect).height ?? 100) / 2)} value={(sel as Rect).rx ?? 0} onChange={(e) => change({ rx: Number(e.target.value), ry: Number(e.target.value) })} className="w-[80px] accent-[#6448f2]" aria-label="Corner radius" />
                      </label>
                    )}
                  </>
                )}
                {fr && (
                  <>
                    <Button variant="ghost" size="sm" icon={<ImageIcon size={15} />} onClick={() => fileRef.current?.click()} disabled={busy === "upload"}>
                      {fr.empty ? "Add image" : "Replace image"}
                    </Button>
                    <Button variant="ghost" size="sm" icon={<Images size={15} />} onClick={() => setPicker(true)} disabled={busy === "upload"}>
                      From Creatives
                    </Button>
                    {!fr.empty && (
                      <>
                        <ToolButton label={adjusting === fr ? "Done repositioning" : "Reposition image (or double-click the frame)"} active={adjusting === fr} onClick={() => (adjusting === fr ? stopAdjust() : startAdjust(fr))}>
                          <Move size={15} />
                        </ToolButton>
                        <label className="flex items-center gap-1 px-1 text-[11px] text-ink-3" title="Zoom the photo inside the frame">
                          Zoom
                          <input type="range" min={1} max={3} step={0.05} value={fr.zoom} onChange={(e) => change({ zoom: Number(e.target.value), dirty: true })} className="w-[80px] accent-[#6448f2]" aria-label="Zoom the photo" />
                        </label>
                        <ToolButton label="Remove image (keep the frame)" onClick={() => { stopAdjust(); fr.clearPhoto(); c().requestRenderAll(); recordRef.current(); bump(); }}>
                          <ImageOff size={15} />
                        </ToolButton>
                      </>
                    )}
                    <Menu
                      width={232}
                      trigger={(p) => (
                        <button type="button" {...p} className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink", p.className)}>
                          <ShapeIcon kind={fr.frame} size={15} />
                          Shape
                        </button>
                      )}
                    >
                      {(close) => (
                        <div className="grid grid-cols-4 gap-1 p-1">
                          {FRAME_SHAPES.map((s) => (
                            <button key={s.kind} type="button" title={s.label} aria-label={`Frame shape: ${s.label.toLowerCase()}`} onClick={() => (close(), change({ frame: s.kind, dirty: true }))} className={cn("flex h-12 items-center justify-center rounded-lg border text-ink-2 hover:border-brand hover:bg-brand-soft hover:text-brand-ink", fr.frame === s.kind ? "border-brand bg-brand-soft text-brand-ink" : "border-line")}>
                              <ShapeIcon kind={s.kind} size={24} />
                            </button>
                          ))}
                        </div>
                      )}
                    </Menu>
                    {adjusting === fr && <span className="px-1 text-[11px] font-medium text-brand-ink">Drag to move the photo · Esc when done</span>}
                  </>
                )}
                {isImage && (
                  <>
                    {sel.clipPath && (
                      <Button variant="ghost" size="sm" onClick={removeCrop}>
                        Remove crop
                      </Button>
                    )}
                    <ToolButton label="Flip" onClick={() => change({ flipX: !sel.flipX })}><FlipHorizontal size={15} /></ToolButton>
                    <Button variant="ghost" size="sm" onClick={() => { const o = sel as FabricImage; const s = fitScale(o.width ?? 1, o.height ?? 1, W, H, "cover"); o.set({ left: W / 2, top: H / 2, scaleX: s, scaleY: s, angle: 0, name: "Background" } as Partial<FabricImage>); setLocked(o, true); c().sendObjectToBack(o); c().discardActiveObject(); c().requestRenderAll(); recordRef.current(); }}>
                      Set as background
                    </Button>
                  </>
                )}
                <label className="flex items-center gap-1 px-1 text-[11px] text-ink-3" title="Opacity">
                  Opacity
                  <input type="range" min={0.05} max={1} step={0.05} value={sel.opacity ?? 1} onChange={(e) => change({ opacity: Number(e.target.value) })} className="w-[70px] accent-[#6448f2]" aria-label="Opacity" />
                </label>
                <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
                <Menu
                  width={180}
                  trigger={(p) => (
                    <button type="button" {...p} title="Align on the ad" aria-label="Align on the ad" className={cn("inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink", p.className)}>
                      <AlignCenterHorizontal size={15} />
                    </button>
                  )}
                >
                  {(close) =>
                    ([
                      ["left", "Left", <AlignStartVertical key="l" size={15} />],
                      ["center", "Centre", <AlignCenterVertical key="c" size={15} />],
                      ["right", "Right", <AlignEndVertical key="r" size={15} />],
                      ["top", "Top", <AlignStartHorizontal key="t" size={15} />],
                      ["middle", "Middle", <AlignCenterHorizontal key="m" size={15} />],
                      ["bottom", "Bottom", <AlignEndHorizontal key="b" size={15} />],
                    ] as [Align, string, ReactNode][]).map(([a, label, icon]) => (
                      <MenuItem key={a} icon={icon} onSelect={() => (close(), align(a))}>
                        {label}
                      </MenuItem>
                    ))
                  }
                </Menu>
                <ToolButton label="Bring to front" onClick={() => order("front")}><BringToFront size={15} /></ToolButton>
                <ToolButton label="Send to back" onClick={() => order("back")}><SendToBack size={15} /></ToolButton>
                <ToolButton label={isLocked(sel) ? "Unlock" : "Lock"} active={isLocked(sel)} onClick={() => toggleLock()}>{isLocked(sel) ? <Lock size={15} /> : <Unlock size={15} />}</ToolButton>
                <ToolButton label="Duplicate (Ctrl+D)" onClick={() => void duplicate()}><Copy size={15} /></ToolButton>
                <ToolButton label="Delete (Delete)" onClick={removeSelected}><Trash2 size={15} /></ToolButton>
              </>
            )}
          </div>

          <div ref={wrapRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden" onDragOver={(e) => canEdit && e.preventDefault()} onDrop={(e) => void onDrop(e)}>
            {!doc ? (
              <Skeleton className="h-[60%] w-[40%] rounded-card" />
            ) : (
              <div className="relative shadow-[0_8px_40px_rgba(17,24,39,0.18)]" style={{ width: Math.round(W * zoom), height: Math.round(H * zoom) }}>
                <canvas ref={elRef} />
                {/* Guides and the safe zone are drawn over the canvas, so they never end up in the export. */}
                {guides.v.map((x) => (
                  <span key={`v${x}`} className="pointer-events-none absolute inset-y-0 w-px bg-[#ec4899]" style={{ left: x * zoom }} aria-hidden="true" />
                ))}
                {guides.h.map((y) => (
                  <span key={`h${y}`} className="pointer-events-none absolute inset-x-0 h-px bg-[#ec4899]" style={{ top: y * zoom }} aria-hidden="true" />
                ))}
                {vertical && safeZone && (
                  <>
                    <span className="pointer-events-none absolute inset-x-0 top-0 flex items-end justify-center border-b border-dashed border-[#ec4899]/70 bg-[#ec4899]/10 pb-1 text-[10px] font-semibold uppercase tracking-[.06em] text-[#be185d]" style={{ height: H * SAFE_TOP * zoom }} aria-hidden="true">
                      Kept clear by Meta
                    </span>
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-start justify-center border-t border-dashed border-[#ec4899]/70 bg-[#ec4899]/10 pt-1 text-[10px] font-semibold uppercase tracking-[.06em] text-[#be185d]" style={{ height: H * SAFE_BOTTOM * zoom }} aria-hidden="true">
                      Captions and buttons sit here
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: layers */}
        <aside className="w-[220px] flex-none overflow-y-auto border-l border-line bg-surface" aria-label="Layers">
          <Section title={`Layers${layers.length ? ` · ${layers.length}` : ""}`}>
            {layers.length === 0 ? (
              <p className="m-0 text-xs text-ink-3">Add text, an image or a shape to start.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {layers.map((o, i) => (
                  <li key={i} className={cn("group flex items-center gap-1 rounded-lg px-1.5 py-1", sel === o ? "bg-brand-soft" : "hover:bg-surface-2")}>
                    <button
                      type="button"
                      onClick={() => {
                        c().setActiveObject(o);
                        c().requestRenderAll();
                        setSelected(o);
                      }}
                      className={cn("min-w-0 flex-1 truncate text-left text-[13px]", o.visible === false ? "text-ink-3 line-through" : "text-ink")}
                    >
                      {layerName(o)}
                    </button>
                    <button type="button" onClick={() => order("up", o)} disabled={i === 0} aria-label="Move up" className="rounded p-0.5 text-ink-3 opacity-0 hover:text-ink disabled:invisible group-hover:opacity-100"><ArrowUp size={13} /></button>
                    <button type="button" onClick={() => order("down", o)} disabled={i === layers.length - 1} aria-label="Move down" className="rounded p-0.5 text-ink-3 opacity-0 hover:text-ink disabled:invisible group-hover:opacity-100"><ArrowDown size={13} /></button>
                    <button type="button" onClick={() => toggleLock(o)} aria-label={isLocked(o) ? "Unlock" : "Lock"} className={cn("rounded p-0.5 hover:text-ink", isLocked(o) ? "text-ink-2" : "text-ink-3 opacity-0 group-hover:opacity-100")}>{isLocked(o) ? <Lock size={13} /> : <Unlock size={13} />}</button>
                    <button type="button" onClick={() => toggleVisible(o)} aria-label={o.visible === false ? "Show" : "Hide"} className={cn("rounded p-0.5 hover:text-ink", o.visible === false ? "text-ink-2" : "text-ink-3 opacity-0 group-hover:opacity-100")}>{o.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Shortcuts">
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[12px] text-ink-2">
              <li>Undo · Ctrl+Z, redo · Ctrl+Shift+Z</li>
              <li>Duplicate · Ctrl+D</li>
              <li>Delete · Delete</li>
              <li>Nudge · arrows (Shift: 10 px)</li>
              <li>Save draft · Ctrl+S</li>
            </ul>
          </Section>
        </aside>
      </div>
      <LibraryPicker open={picker} onClose={() => setPicker(false)} onPick={(cr) => void addFromCreative(cr.id)} />
      {dialog}
    </div>
  );
}
