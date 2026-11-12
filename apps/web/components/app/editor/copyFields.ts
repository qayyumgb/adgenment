import { Textbox, type Canvas, type FabricObject } from "fabric";

/**
 * C19c: the design's text boxes as fields for "Write the text with AI": a
 * role (from the layer name, the template part, or the text itself) and a
 * length limit that fits the box, so the new wording doesn't overflow it.
 * Customer quotes and names are sent as "quote" / "attribution" and come
 * back unchanged; symbol-only text (★★★★★) isn't sent at all.
 */

export type CopyRole = "headline" | "subheading" | "body" | "eyebrow" | "button" | "price" | "quote" | "attribution" | "text";
export type CopyField = { id: string; role: CopyRole; current: string; maxChars: number };

const ROLE_MAX: Record<CopyRole, number> = { headline: 45, subheading: 80, body: 150, eyebrow: 24, button: 20, price: 14, quote: 200, attribution: 60, text: 120 };
const TESTIMONIAL_TEMPLATES = ["testimonial", "testimonial-dark"];

function roleOf(t: Textbox): CopyRole | null {
  const text = (t.text ?? "").trim();
  if (!/\p{L}|\d/u.test(text)) return null; // stars, dashes, emoji-only
  const name = (t as Textbox & { name?: string }).name ?? "";
  const slot = (t as Textbox & { slot?: string }).slot ?? "";
  const [tpl, , item] = slot.split("|");
  if (/^[“"«„]/.test(text)) return "quote";
  if (TESTIMONIAL_TEMPLATES.includes(tpl) && item === "2") return "attribution";
  if (name === "Eyebrow") return "eyebrow";
  if (/Button/.test(name)) return "button";
  if (/^[$€£₹₨]\s?\d|^\d+([.,]\d+)?\s?(%|[$€£])/.test(text) && text.length <= 12) return "price";
  if (name === "Heading") return "headline";
  if (name === "Subheading") return "subheading";
  return text.length > 60 ? "body" : "text";
}

/** How many characters fit: the current number of lines plus one, at this font size and box width. */
function fitChars(t: Textbox) {
  const fs = (t.fontSize ?? 40) * (t.scaleY ?? 1);
  const width = (t.width ?? 400) * (t.scaleX ?? 1);
  const perLine = Math.max(6, Math.floor(width / (fs * 0.55)));
  const lines = Math.max(1, (t.textLines ?? [t.text]).length);
  return perLine * (lines + 1);
}

export function collectCopyFields(c: Canvas): { fields: CopyField[]; byId: Map<string, Textbox> } {
  const fields: CopyField[] = [];
  const byId = new Map<string, Textbox>();
  c.getObjects().forEach((o: FabricObject, i) => {
    if (!(o instanceof Textbox) || o.visible === false) return;
    const role = roleOf(o);
    if (!role) return;
    const current = (o.text ?? "").trim();
    const id = `t${i}`;
    const generous = Math.round(current.length * 1.3) + 6;
    const maxChars = Math.max(8, Math.min(ROLE_MAX[role], fitChars(o), role === "button" || role === "eyebrow" ? ROLE_MAX[role] : Math.max(generous, 24)));
    fields.push({ id, role, current, maxChars });
    byId.set(id, o);
  });
  return { fields: fields.slice(0, 20), byId };
}
