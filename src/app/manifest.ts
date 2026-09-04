import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "德馨星云 DEXIN Nebula",
    short_name: "德馨星云",
    description: "企业数字化经营、供应链、财务与协同工作台",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f1f6f9",
    theme_color: "#0a385d",
    orientation: "any",
    icons: [
      {
        src: "/dexin-nebula-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
