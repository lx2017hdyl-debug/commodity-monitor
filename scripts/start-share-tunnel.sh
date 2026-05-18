#!/usr/bin/env bash
# 公司网打不开 vercel.app 时：本机启动网站 + Cloudflare 免费公网链接（无需买服务器）
# 用法：bash scripts/start-share-tunnel.sh
set -euo pipefail

cd "$(dirname "$0")/.."
PORT="${PORT:-3000}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "==> 未安装 cloudflared，正在用 Homebrew 安装..."
  if ! command -v brew >/dev/null 2>&1; then
    echo "请先安装 Homebrew: https://brew.sh"
    echo "或手动安装: brew install cloudflared"
    exit 1
  fi
  brew install cloudflared
fi

if [ ! -d node_modules ]; then
  echo "==> 安装依赖..."
  npm ci 2>/dev/null || npm install
fi

if [ ! -d .next ]; then
  echo "==> 生产构建（首次约 2 分钟）..."
  export NEXT_PUBLIC_DATA_MODE=server
  npm run build
fi

echo "==> 启动本地服务 http://127.0.0.1:${PORT} ..."
export NEXT_PUBLIC_DATA_MODE=server
npm run start:intranet &
APP_PID=$!

cleanup() {
  kill "$APP_PID" 2>/dev/null || true
  kill "$TUNNEL_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 3

echo ""
echo "==> 启动 Cloudflare 隧道（免费 HTTPS 链接）..."
echo "    下方会出现 trycloudflare.com 地址，复制发给同事即可。"
echo "    按 Ctrl+C 停止（本机关机后链接失效）。"
echo ""

cloudflared tunnel --url "http://127.0.0.1:${PORT}" &
TUNNEL_PID=$!
wait "$TUNNEL_PID"
