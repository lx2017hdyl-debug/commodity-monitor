#!/usr/bin/env bash
# 内网服务器一键构建并启动（需已安装 Node.js 18+ 与 npm）
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> 安装依赖..."
npm ci 2>/dev/null || npm install

echo "==> 生产构建..."
npm run build

echo "==> 启动方式（二选一）："
echo ""
echo "【方式 A】前台测试（Ctrl+C 停止）："
echo "  npm run start:intranet"
echo ""
echo "【方式 B】PM2 后台常驻（推荐）："
echo "  npm install -g pm2   # 若未安装"
echo "  pm2 start ecosystem.config.cjs"
echo "  pm2 save"
echo "  pm2 startup          # 按提示执行，实现开机自启"
echo ""
echo "同事访问地址：http://<本机内网IP>:3000"
echo "查看 IP：ip addr（Linux）或 ipconfig（Windows）"
