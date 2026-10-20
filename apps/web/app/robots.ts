import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Product surfaces are auth-gated and live on app.advertix.io anyway.
      disallow: ["/api/", "/dashboard", "/sign-in", "/sign-up", "/connect"],
    },
    sitemap: "https://advertix.io/sitemap.xml",
  };
}
