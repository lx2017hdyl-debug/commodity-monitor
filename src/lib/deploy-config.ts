/**
 * 部署模式：server = 国内服务器 API 拉行情（阿里云 ECS）；browser = 浏览器直连（Vercel 等）
 */
export function isServerDataMode(): boolean {
  return process.env.NEXT_PUBLIC_DATA_MODE === "server";
}
