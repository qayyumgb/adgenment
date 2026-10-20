import type { MetadataRoute } from "next";

const BASE = "https://advertix.io";

// Public marketing routes only — the product lives on app.advertix.io.
const ROUTES: { path: string; priority: number }[] = [
  { path: "", priority: 1 },
  { path: "/product", priority: 0.9 },
  { path: "/how-it-works", priority: 0.8 },
  { path: "/agencies", priority: 0.8 },
  { path: "/pricing", priority: 0.9 },
  { path: "/about", priority: 0.6 },
  { path: "/contact", priority: 0.6 },
  { path: "/privacy", priority: 0.3 },
  { path: "/terms", priority: 0.3 },
  { path: "/data-deletion", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((r) => ({
    url: `${BASE}${r.path}`,
    changeFrequency: "monthly",
    priority: r.priority,
  }));
}
