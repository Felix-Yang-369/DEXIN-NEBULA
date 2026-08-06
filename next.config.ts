import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.193"],
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "yzedobnkuyqhthyitmwn.supabase.co",
        pathname: "/storage/v1/object/sign/avatars/**",
      },
    ],
  },
};

export default nextConfig;
