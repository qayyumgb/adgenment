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
        },
        primary: {
          DEFAULT: "#6366f1",
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        dark: {
          bg: "#0f172a",
          surface: "#1e293b",
          border: "#334155",
        },
        sidebar: {
          bg: "#0f172a",
          border: "rgba(255,255,255,0.06)",
          text: "#64748b",
          active: "#ffffff",
        },
      },
      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
          "Inter",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mk: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        "mk-serif": ["var(--font-mk-serif)", "Georgia", "serif"],
        "mk-mono": ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        "mk-card":
          "0 1px 2px rgba(21,19,26,.04), 0 18px 40px -22px rgba(40,30,80,.28)",
        "mk-brand": "0 14px 30px -14px rgba(100,72,242,.8)",
        glow: "0 0 20px rgba(99, 102, 241, 0.35)",
        card: "0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.06)",
        "card-hover":
          "0 8px 24px -6px rgba(15, 23, 42, 0.12), 0 2px 6px -2px rgba(15, 23, 42, 0.06)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(-12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        "count-up": {
          from: { opacity: "0", transform: "translateY(6px) scale(0.96)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.7", transform: "scale(1.2)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
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
        "fade-in": "fade-in 0.5s ease-out both",
        "slide-in": "slide-in 0.4s ease-out both",
        shimmer: "shimmer 2s linear infinite",
        "count-up": "count-up 0.6s ease-out both",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "gradient-shift": "gradient-shift 6s ease infinite",
        "mk-ping": "mk-ping 2s ease-out infinite",
        "mk-flow": "mk-flow 1.2s linear infinite",
        "mk-tab": "mk-tab 9s linear forwards",
      },
    },
  },
  plugins: [],
};

export default config;
