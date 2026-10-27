import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/shared/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      // Marketing-site breakpoints (docs/MARKETING_REDESIGN_PLAN.md § 3.1).
      // Use only `mk-*` screens on marketing pages: they're appended after
      // the defaults, so mixing them with sm/md/lg on one element can
      // reorder the media queries.
      screens: {
        "mk-sm": "600px",
        "mk-md": "760px",
        "mk-lg": "960px",
        "mk-xl": "1100px",
        "mk-2xl": "1320px",
      },
      colors: {
        // App tokens (docs/Advertix UI Guide.md §2.1), defined as RGB channels
        // in app/globals.css so opacity modifiers work (bg-brand/10).
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--c-surface) / <alpha-value>)",
          2: "rgb(var(--c-surface-2) / <alpha-value>)",
          3: "rgb(var(--c-surface-3) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--c-ink) / <alpha-value>)",
          2: "rgb(var(--c-ink-2) / <alpha-value>)",
          3: "rgb(var(--c-ink-3) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--c-line) / <alpha-value>)",
          2: "rgb(var(--c-line-2) / <alpha-value>)",
        },
        brand: {
          DEFAULT: "rgb(var(--c-brand) / <alpha-value>)",
          hover: "rgb(var(--c-brand-hover) / <alpha-value>)",
          soft: "rgb(var(--c-brand-soft) / <alpha-value>)",
          "soft-2": "rgb(var(--c-brand-soft-2) / <alpha-value>)",
          ink: "rgb(var(--c-brand-ink) / <alpha-value>)",
          mid: "rgb(var(--c-brand-mid) / <alpha-value>)",
        },
        "on-mid": "rgb(var(--c-on-mid) / <alpha-value>)",
        pos: {
          DEFAULT: "rgb(var(--c-pos) / <alpha-value>)",
          soft: "rgb(var(--c-pos-soft) / <alpha-value>)",
        },
        neg: {
          DEFAULT: "rgb(var(--c-neg) / <alpha-value>)",
          soft: "rgb(var(--c-neg-soft) / <alpha-value>)",
        },
        warn: {
          DEFAULT: "rgb(var(--c-warn) / <alpha-value>)",
          soft: "rgb(var(--c-warn-soft) / <alpha-value>)",
        },
        // Marketing tokens. Values live as CSS variables on `.mk` in
        // app/(marketing)/marketing.css so they never leak into the dashboard.
        mk: {
          paper: "rgb(var(--mk-paper) / <alpha-value>)",
          paper2: "rgb(var(--mk-paper2) / <alpha-value>)",
          s2: "rgb(var(--mk-s2) / <alpha-value>)",
          s3: "rgb(var(--mk-s3) / <alpha-value>)",
          ink: "rgb(var(--mk-ink) / <alpha-value>)",
          ink2: "rgb(var(--mk-ink2) / <alpha-value>)",
          ink3: "rgb(var(--mk-ink3) / <alpha-value>)",
          brand: "rgb(var(--mk-brand) / <alpha-value>)",
          "brand-hover": "rgb(var(--mk-brand-hover) / <alpha-value>)",
          "brand-ink": "rgb(var(--mk-brand-ink) / <alpha-value>)",
          soft: "rgb(var(--mk-soft) / <alpha-value>)",
          pos: "rgb(var(--mk-pos) / <alpha-value>)",
          neg: "rgb(var(--mk-neg) / <alpha-value>)",
          warn: "rgb(var(--mk-warn) / <alpha-value>)",
          line: "rgb(var(--mk-ink) / 0.09)",
          line2: "rgb(var(--mk-ink) / 0.16)",
          hair: "rgb(var(--mk-ink) / 0.12)",
          rule: "rgb(var(--mk-ink) / 0.12)",
          night: "rgb(var(--mk-night) / <alpha-value>)",
          "on-dark": "rgb(var(--mk-on-dark) / <alpha-value>)",
          "on-dark2": "rgb(var(--mk-on-dark2) / <alpha-value>)",
          "on-dark3": "rgb(var(--mk-on-dark3) / <alpha-value>)",
          lav: "rgb(var(--mk-lav) / <alpha-value>)",
          "lav-ink": "rgb(var(--mk-lav-ink) / <alpha-value>)",
          "pos-on-dark": "rgb(var(--mk-pos-on-dark) / <alpha-value>)",
          "pos-soft": "rgb(var(--mk-pos-soft) / <alpha-value>)",
          "neg-soft": "rgb(var(--mk-neg-soft) / <alpha-value>)",
          "warn-soft": "rgb(var(--mk-warn-soft) / <alpha-value>)",
          band: "rgb(var(--mk-band) / <alpha-value>)",
          "on-light": "rgb(var(--mk-on-light) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        mk: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        "mk-serif": ["var(--font-mk-serif)", "Georgia", "serif"],
        "mk-mono": ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        "mk-card":
          "0 1px 2px rgba(21,19,26,.04), 0 18px 40px -22px rgba(40,30,80,.28)",
        "mk-brand": "0 14px 30px -14px rgba(100,72,242,.8)",
        // App: cards / menus, drawers, dialogs (guide §2.3).
        card: "var(--shadow)",
        pop: "var(--shadow-lg)",
      },
      borderRadius: {
        // Guide §2.3: 16 cards · 14 menus · 10 buttons/inputs.
        card: "16px",
        menu: "14px",
        ctl: "10px",
      },
      keyframes: {
        "mk-ping": {
          "0%": { transform: "scale(1)", opacity: "0.7" },
          "100%": { transform: "scale(2.6)", opacity: "0" },
        },
        "mk-flow": { to: { strokeDashoffset: "-64" } },
        "mk-tab": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
      },
      animation: {
        "mk-ping": "mk-ping 2s ease-out infinite",
        "mk-flow": "mk-flow 1.2s linear infinite",
        "mk-tab": "mk-tab 9s linear forwards",
      },
    },
  },
  plugins: [],
};

export default config;
