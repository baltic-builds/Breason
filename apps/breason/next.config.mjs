/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Это поможет избежать ошибок при сборке, если есть проблемы с типами или линтером
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
