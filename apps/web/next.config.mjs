/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@kwota/core"],
  reactStrictMode: true,
  webpack: (config) => {
    // optional peer deps of wallet SDKs that are not used in the browser build
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};
export default nextConfig;
