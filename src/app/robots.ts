export const dynamic = "force-static";
import { site } from "@/site";
import type { MetadataRoute } from "next";

const robots = (): MetadataRoute.Robots => {
  return {
    rules: {
      userAgent: "*",
      // Uploads are served from the API; keep them indexable.
      allow: ["/", "/api/media/file/"],
      disallow: ["/admin", "/api"],
    },
    sitemap: new URL("/sitemap.xml", site.url).href,
  };
};

export default robots;
