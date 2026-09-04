import type { NextConfig } from "next";

const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function avatarRemotePatterns() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!configuredUrl) return [];

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return [];
    return [
      {
        protocol: url.protocol === "https:" ? ("https" as const) : ("http" as const),
        hostname: url.hostname,
        port: url.port,
        pathname: "/storage/v1/object/sign/avatars/**",
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  experimental: {
    serverActions: {
      // Leave room for multipart form fields around the 20 MB file limit.
      bodySizeLimit: "22mb",
    },
  },
  // Keep Turbopack's frequently-written caches out of iCloud sync.
  // `.nosync` directories remain local and avoid partially-hydrated cache files.
  // Vercel requires the conventional `.next` output directory.
  distDir: process.env.VERCEL
    ? ".next"
    : process.env.NODE_ENV === "development"
      ? ".next-dev.nosync"
      : ".next-build.nosync",
  images: {
    remotePatterns: avatarRemotePatterns(),
    maximumRedirects: 0,
  },
  async headers() {
    return [
      {
        source: "/customer-service/widget/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors https://dexinmiaosheng.cn https://www.dexinmiaosheng.cn http://localhost:3001",
          },
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
