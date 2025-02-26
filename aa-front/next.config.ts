import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: [
      'cdn.jsdelivr.net',
      'zengo.com',
      'cryptologos.cc',
      'coin-images.coingecko.com',
      'jpyc.jp',
    ],
  },
};

export default nextConfig;
