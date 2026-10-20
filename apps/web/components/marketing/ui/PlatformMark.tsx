/**
 * Coloured letter tile standing in for a platform logo (mockup style).
 * Platform colours appear only here.
 */
export type PlatformKey = "M" | "G" | "T" | "S" | "L";

export const PLATFORMS: Record<PlatformKey, { name: string; mark: string; bg: string; fg: string }> = {
  M: { name: "Meta", mark: "M", bg: "#1877f2", fg: "#fff" },
  G: { name: "Google", mark: "G", bg: "#ea4335", fg: "#fff" },
  T: { name: "TikTok", mark: "T", bg: "#111", fg: "#fff" },
  S: { name: "Snapchat", mark: "S", bg: "#fffc00", fg: "#111" },
  L: { name: "LinkedIn", mark: "in", bg: "#0a66c2", fg: "#fff" },
};

export function PlatformMark({
  p,
  size = 28,
  onDark = false,
  className = "",
}: {
  p: PlatformKey;
  size?: number;
  /** TikTok inverts to a light tile on dark panels. */
  onDark?: boolean;
  className?: string;
}) {
  const def = PLATFORMS[p];
  const bg = p === "T" && onDark ? "#f4f2fa" : def.bg;
  const fg = p === "T" && onDark ? "#15131a" : def.fg;
  return (
    <span
      role="img"
      aria-label={def.name}
      className={`inline-flex flex-none items-center justify-center font-bold leading-none ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: bg,
        color: fg,
        fontSize: Math.round(size * 0.42),
      }}
    >
      {def.mark}
    </span>
  );
}
