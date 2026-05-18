#!/usr/bin/env bash
# 公司网打不开 vercel.app 时：本机启动网站 + Cloudflare 免费公网链接（无需买服务器）
# 用法：bash scripts/start-share-tunnel.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"
PORT="${PORT:-3000}"
LOCAL_CF="${ROOT}/.bin/cloudflared"

if [ -x "${LOCAL_CF}" ]; then
  CLOUDFLARED="${LOCAL_CF}"
elif command -v cloudflared >/dev/null 2>&1; then
  CLOUDFLARED="cloudflared"
else
  echo "==> 下载 cloudflared 到项目 .bin 目录..."
  mkdir -p "${ROOT}/.bin"
  ARCH="$(uname -m)"
  case "${ARCH}" in
    arm64) CF_ARCH="arm64" ;;
    x86_64) CF_ARCH="amd64" ;;
    *) echo "不支持的架构: ${ARCH}"; exit 1 ;;
  esac
  curl -fsSL -o "${ROOT}/.bin/cloudflared.tgz" \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-${CF_ARCH}.tgz"
  tar -xzf "${ROOT}/.bin/cloudflared.tgz" -C "${ROOT}/.bin"
  chmod +x "${LOCAL_CF}"
  rm -f "${ROOT}/.bin/cloudflared.tgz"
  CLOUDFLARED="${LOCAL_CF}"
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

"${CLOUDFLARED}" tunnel --url "http://127.0.0.1:${PORT}" &
TUNNEL_PID=$!
wait "$TUNNEL_PID"
