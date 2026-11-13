import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // PDFs das contas sobem pelo formulário de lançamento
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
