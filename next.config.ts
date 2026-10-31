import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 같은 와이파이의 팀원 폰에서 개발 서버를 열 수 있게 허용
  allowedDevOrigins: ["192.168.10.5"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
