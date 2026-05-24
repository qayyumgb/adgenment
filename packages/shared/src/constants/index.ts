import type { Platform } from "../types";

export interface PlatformInfo {
  id: Platform;
  name: string;
  color: string;
  icon: string;
}

export const PLATFORMS: PlatformInfo[] = [
  { id: "META", name: "Meta", color: "#1877F2", icon: "facebook" },
  { id: "GOOGLE", name: "Google Ads", color: "#4285F4", icon: "google" },
  { id: "TIKTOK", name: "TikTok", color: "#000000", icon: "tiktok" },
  { id: "LINKEDIN", name: "LinkedIn", color: "#0A66C2", icon: "linkedin" },
  { id: "YOUTUBE", name: "YouTube", color: "#FF0000", icon: "youtube" },
  { id: "SNAPCHAT", name: "Snapchat", color: "#FFFC00", icon: "snapchat" },
  { id: "PINTEREST", name: "Pinterest", color: "#E60023", icon: "pinterest" },
  { id: "X", name: "X (Twitter)", color: "#000000", icon: "x" },
];

export const PLATFORM_BY_ID = Object.fromEntries(
  PLATFORMS.map((p) => [p.id, p])
) as Record<Platform, PlatformInfo>;

export const PLAN_LIMITS = {
  FREE: { workspaces: 1, campaigns: 3, aiTokens: 10_000 },
  STARTER: { workspaces: 1, campaigns: 25, aiTokens: 250_000 },
  PRO: { workspaces: 5, campaigns: 250, aiTokens: 2_500_000 },
  ENTERPRISE: { workspaces: Infinity, campaigns: Infinity, aiTokens: Infinity },
} as const;

export const API_ROUTES = {
  health: "/health",
  auth: "/api/auth",
  campaigns: "/api/campaigns",
  analytics: "/api/analytics",
  ai: "/api/ai",
} as const;
