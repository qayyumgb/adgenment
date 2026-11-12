/**
 * Fonts for the creative editor (plan C19a): a curated Google Fonts set that
 * covers ad styles (clean sans, bold display, serif, script). The stylesheet
 * is added once when the editor opens; text only renders on the canvas after
 * its font has loaded, so exports never fall back to a system font.
 */

export type EditorFont = { family: string; weights: number[]; style: "Sans" | "Display" | "Serif" | "Script" };

export const FONTS: EditorFont[] = [
  { family: "Inter", weights: [400, 600, 700, 800], style: "Sans" },
  { family: "Poppins", weights: [400, 600, 700, 800], style: "Sans" },
  { family: "Montserrat", weights: [400, 600, 700, 800], style: "Sans" },
  { family: "DM Sans", weights: [400, 700], style: "Sans" },
  { family: "Roboto", weights: [400, 700], style: "Sans" },
  { family: "Lato", weights: [400, 700], style: "Sans" },
  { family: "Space Grotesk", weights: [400, 700], style: "Sans" },
  { family: "Bebas Neue", weights: [400], style: "Display" },
  { family: "Anton", weights: [400], style: "Display" },
  { family: "Oswald", weights: [400, 700], style: "Display" },
  { family: "Archivo Black", weights: [400], style: "Display" },
  { family: "Playfair Display", weights: [400, 700], style: "Serif" },
  { family: "Merriweather", weights: [400, 700], style: "Serif" },
  { family: "DM Serif Display", weights: [400], style: "Serif" },
  { family: "Pacifico", weights: [400], style: "Script" },
  { family: "Dancing Script", weights: [400, 700], style: "Script" },
  { family: "Caveat", weights: [400, 700], style: "Script" },
];
export const DEFAULT_FONT = "Inter";

const HREF = `https://fonts.googleapis.com/css2?${FONTS.map((f) => `family=${f.family.replace(/ /g, "+")}:wght@${f.weights.join(";")}`).join("&")}&display=swap`;

let sheet: Promise<void> | null = null;
/** Add the stylesheet once; resolves when it has loaded (or failed), so fonts can be measured after it. */
export function addFontStylesheet(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (sheet) return sheet;
  const existing = document.getElementById("advertix-editor-fonts") as HTMLLinkElement | null;
  if (existing?.sheet) return (sheet = Promise.resolve());
  sheet = new Promise<void>((resolve) => {
    const link = existing ?? document.createElement("link");
    const done = () => resolve();
    link.addEventListener("load", done, { once: true });
    link.addEventListener("error", done, { once: true });
    setTimeout(done, 8000); // never hang on a slow network: draw with the fallback instead
    if (!existing) {
      link.id = "advertix-editor-fonts";
      link.rel = "stylesheet";
      link.href = HREF;
      document.head.appendChild(link);
    }
  });
  return sheet;
}

/** Resolve when the family (at that weight) can be drawn; never throws. */
export async function loadFont(family: string, weight: number | string = 400, italic = false) {
  if (typeof document === "undefined") return;
  // The @font-face rules must exist before document.fonts can load them (else it resolves at once, with nothing).
  await addFontStylesheet();
  try {
    await document.fonts.load(`${italic ? "italic " : ""}${weight} 48px "${family}"`);
  } catch {
    /* draw with the fallback rather than fail */
  }
}

/** The weight closest to `want` that the family has (Anton has only 400, so 800 → 400). */
export function nearestWeight(family: string, want: number) {
  const ws = FONTS.find((f) => f.family === family)?.weights ?? [want];
  return ws.reduce((best, w) => (Math.abs(w - want) < Math.abs(best - want) ? w : best), ws[0]);
}
