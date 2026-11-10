/**
 * The product moment on the auth brand panel: spend across clients, an AI
 * suggestion that gets approved (with undo), and the connected platforms
 * syncing. Three calm, stacked cards; decorative only (aria-hidden). Motion
 * lives in auth.css and stops under reduced motion.
 */

const PLATFORMS = [
  { name: "Meta", color: "#1877f2" },
  { name: "Google", color: "#ea4335" },
  { name: "TikTok", color: "#16141f" },
  { name: "LinkedIn", color: "#0a66c2" },
];

const LINE = "M0 58 C18 54 30 42 48 45 S80 60 100 49 S134 24 154 30 S186 44 206 27 S238 12 260 9";

const CARD = "adx-auth-rise rounded-xl border-[1.5px] border-brand/55 bg-surface-2/70 px-4 py-3.5 text-left";

export function AuthVisual() {
  return (
    <div className="adx-auth-motion flex w-full max-w-[400px] select-none flex-col gap-2.5" aria-hidden="true">
      {/* Spend */}
      <div className={CARD}>
        <div className="flex items-center justify-between text-[11px] text-ink-2">
          <span>Spend · all clients</span>
          <span>Last 7 days</span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[20px] font-semibold tracking-tight text-ink">$48,210</span>
          <span className="rounded-md bg-pos-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-pos">ROAS 3.6x</span>
        </div>
        <svg viewBox="0 0 260 70" preserveAspectRatio="none" className="mt-1.5 h-[64px] w-full overflow-visible">
          <defs>
            <linearGradient id="adx-auth-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6448f2" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#6448f2" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="adx-auth-area" d={`${LINE} L260 70 L0 70 Z`} fill="url(#adx-auth-fill)" />
          <path className="adx-auth-line" d={LINE} pathLength={1} fill="none" stroke="#6448f2" strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      {/* Suggestion → applied */}
      <div className={`${CARD} [animation-delay:80ms]`}>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand-ink">✦ Suggestion</span>
          <span className="text-ink-2">Meta · Summer sale</span>
        </div>
        <div className="relative mt-2 h-[74px]">
          <div className="adx-auth-ask absolute inset-0">
            <p className="m-0 text-[13.5px] font-semibold leading-snug text-ink">Move 15% of budget to Reels</p>
            <p className="m-0 mt-0.5 text-[11.5px] text-ink-2">Expected ROAS 3.1x → 3.7x</p>
            <div className="mt-2 flex gap-2">
              <span className="adx-auth-approve rounded-lg bg-brand px-3 py-1.5 text-[11.5px] font-semibold text-white">Approve</span>
              <span className="rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-[11.5px] font-medium text-ink-2">Skip</span>
            </div>
          </div>
          <div className="adx-auth-done absolute inset-0">
            <p className="m-0 flex items-center gap-1.5 text-[13.5px] font-semibold leading-snug text-ink">
              <span className="text-pos">✓</span>
              Applied on Meta
            </p>
            <p className="m-0 mt-0.5 text-[11.5px] text-ink-2">Budget moved to Reels. Undo any time for 7 days.</p>
            <span className="mt-2 inline-block rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-[11.5px] font-medium text-brand-ink">Undo</span>
          </div>
        </div>
      </div>

      {/* Platforms */}
      <div className={`${CARD} [animation-delay:160ms]`}>
        <div className="flex items-center justify-between text-[11px] text-ink-2">
          <span>Connected platforms</span>
          <span className="flex items-center gap-1.5">
            <span className="adx-auth-pulse h-1.5 w-1.5 rounded-full bg-pos" />
            Synced
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PLATFORMS.map((p) => (
            <span key={p.name} className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-ink">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
