import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.23.65.219", "192.168.10.230", "localhost", "127.0.0.1"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://hq.sinajs.cn https://stock2.finance.sina.com.cn",
              "connect-src 'self' https://hq.sinajs.cn https://*.sina.com.cn https://*.sinajs.cn https://stock2.finance.sina.com.cn https://api.allorigins.win https://corsproxy.io",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
