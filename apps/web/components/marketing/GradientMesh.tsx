/**
 * Pure-CSS animated gradient mesh used as a hero background. Three radial
 * blobs in indigo/violet/pink slowly drift via the `gradient-shift` keyframe
 * already in tailwind.config.ts. Sits absolutely positioned; parent must be
 * `relative` + `overflow-hidden`.
 */
export function GradientMesh({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {/* Base dark gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1e1b4b_0%,_#0b0b1a_60%,_#000_100%)]" />

      {/* Animated color blobs */}
      <div className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-indigo-600/40 blur-[120px] animate-pulse" />
      <div
        className="absolute right-0 top-1/3 h-[500px] w-[500px] rounded-full bg-violet-600/40 blur-[120px] animate-pulse"
        style={{ animationDelay: "1s", animationDuration: "4s" }}
      />
      <div
        className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-fuchsia-500/30 blur-[120px] animate-pulse"
        style={{ animationDelay: "2s", animationDuration: "5s" }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />

      {/* Noise / grain */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
