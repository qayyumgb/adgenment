/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@adgenius/shared"],

  // Security headers — applied to every route. CSP intentionally omitted here
  // because Clerk + Next streaming + popup OAuth all interact with it; add
  // one via a separate header rule only after testing the auth flow end to
  // end on production.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // HSTS — Vercel terminates TLS, so it's safe to opt in.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },

  // Trusted external image hosts. `remotePatterns` is the Next 14 recommended
  // shape (replaces the deprecated `images.domains`).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "platform-lookaside.fbsbx.com" },
      { protocol: "https", hostname: "scontent.cdninstagram.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.amazonaws.com" },
    ],
  },

  // Note: we intentionally do NOT redirect "/" → "/dashboard". The root path
  // is the marketing landing (apps/web/app/page.tsx); redirecting it would
  // bounce signed-out visitors straight to /sign-in and effectively delete
  // the public homepage.
};

module.exports = nextConfig;
