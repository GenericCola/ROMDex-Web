export const dynamic = "force-static";
import { site } from "@/site";
import type { MetadataRoute } from "next";

// Add an entry per public route.
const ROUTES = ["/"];

const toEntry = (route: string): MetadataRoute.Sitemap[number] => {
  return { url: new URL(route, site.url).href, lastModified: new Date() };
};

const sitemap = (): MetadataRoute.Sitemap => {
  return ROUTES.map(toEntry);
};

export default sitemap;
