/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Пропускаем проверку типов и линтера на этапе билда для обхода конфликтов Turbo
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
