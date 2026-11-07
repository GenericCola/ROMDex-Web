import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  experimental: { globalNotFound: true },
  // Dev server reached through the VPS proxy; ignored by the static build.
  allowedDevOrigins: ["nextjsdev.letmecome.in"],
};
const devApi = `http://127.0.0.1:${process.env.ROMDEX_DEV_API_PORT ?? 3002}`;
/** Development only: forward /api/* to server/dev-api.ts (see scripts/dev.mjs). */
async function devRewrites() {
  return [{ source: "/api/:path*", destination: devApi + "/api/:path*" }];
}
/** @param {string} phase */
export default function config(phase) {
  if (phase !== PHASE_DEVELOPMENT_SERVER) return nextConfig;
  // The API keeps its slash-less paths; the client fetches with redirect: "error".
  return {
    ...nextConfig,
    skipTrailingSlashRedirect: true,
    rewrites: devRewrites,
  };
}
