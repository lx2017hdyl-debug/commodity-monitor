#!/usr/bin/env bash
# 从本机通过 SSH 部署到已有阿里云 ECS
# 用法：bash scripts/push-deploy-aliyun.sh root@你的ECS公网IP
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "用法: bash scripts/push-deploy-aliyun.sh <user@ecs-ip>"
  echo "示例: bash scripts/push-deploy-aliyun.sh root@47.96.xxx.xxx"
  exit 1
fi

REMOTE="$1"
APP_DIR="/opt/commodity-monitor"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> 同步代码到 ${REMOTE}:${APP_DIR}..."
ssh "${REMOTE}" "mkdir -p ${APP_DIR}"
rsync -avz --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  "${ROOT}/" "${REMOTE}:${APP_DIR}/"

echo "==> 远程构建并启动 Docker..."
ssh "${REMOTE}" "cd ${APP_DIR} && docker compose build && docker compose up -d"

echo ""
echo "==> 完成。请在浏览器打开: http://<ECS公网IP>:3000"
