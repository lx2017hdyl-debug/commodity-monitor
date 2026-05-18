/**
 * 部署模式：server = 服务端 API 拉行情（Vercel / 阿里云）；browser = 仅浏览器直连（备用）
 */
export function isServerDataMode(): boolean {
  return process.env.NEXT_PUBLIC_DATA_MODE === "server";
}
