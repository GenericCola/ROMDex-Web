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
export default nextConfig;
