import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许通过内网 IP 访问开发服务器（否则页面 HTML 能打开但 JS 不加载）
  allowedDevOrigins: ["172.23.65.219", "192.168.10.230", "localhost", "127.0.0.1"],
};

export default nextConfig;
