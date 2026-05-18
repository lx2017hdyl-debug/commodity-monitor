#!/usr/bin/env bash
# 在阿里云 ECS（Ubuntu 22.04 / 24.04）上执行：安装 Docker 并启动本应用
# 用法：curl 下载后 bash deploy-aliyun-ecs.sh
# 或在项目根目录：bash scripts/deploy-aliyun-ecs.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/commodity-monitor}"
REPO_URL="${REPO_URL:-https://github.com/lx2017hdyl-debug/commodity-monitor.git}"
BRANCH="${BRANCH:-main}"

echo "==> 安装 Docker（若已安装则跳过）..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

if ! docker compose version >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq git docker-compose-plugin 2>/dev/null || true
fi

echo "==> 拉取代码到 ${APP_DIR}..."
if [ -d "${APP_DIR}/.git" ]; then
  cd "${APP_DIR}"
  git fetch origin
  git checkout "${BRANCH}"
  git pull origin "${BRANCH}"
else
  git clone --depth 1 -b "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
  cd "${APP_DIR}"
fi

echo "==> 构建并启动容器..."
docker compose build --no-cache
docker compose up -d

echo ""
echo "==> 部署完成"
echo "    本机访问: http://127.0.0.1:3000"
echo "    公网访问: http://<ECS公网IP>:3000"
echo "    请确保安全组已放行 TCP 3000（或 80 若配置了 Nginx）"
echo ""
docker compose ps
