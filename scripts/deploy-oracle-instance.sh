#!/usr/bin/env bash
# 在 Oracle Cloud「永久免费」实例上执行：开放端口、安装 Docker、启动应用
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/commodity-monitor}"
REPO_URL="${REPO_URL:-https://github.com/lx2017hdyl-debug/commodity-monitor.git}"
BRANCH="${BRANCH:-main}"

echo "==> 开放本机防火墙（Oracle 默认会挡 3000 端口）..."
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow OpenSSH
  ufw allow 3000/tcp
fi

# Oracle Ubuntu 镜像常见：INPUT 链末尾 REJECT，需在 REJECT 前插入规则
if iptables -L INPUT -n 2>/dev/null | grep -q "REJECT"; then
  iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT 2>/dev/null || true
  iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
  iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
  if command -v netfilter-persistent >/dev/null 2>&1; then
    netfilter-persistent save 2>/dev/null || true
  elif [ -d /etc/iptables ]; then
    iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
  fi
fi

echo "==> 安装 Docker（若已安装则跳过）..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

if ! docker compose version >/dev/null 2>&1; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git ca-certificates curl
  apt-get install -y -qq docker-compose-plugin 2>/dev/null || true
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

echo "==> 构建并启动（ARM 首次约 5～10 分钟）..."
docker compose build
docker compose up -d

echo ""
echo "==> 部署完成"
echo "    本机: curl -s http://127.0.0.1:3000/api/quotes | head"
echo "    公网: http://<实例公网IP>:3000"
echo ""
echo "    若外网打不开，请到 Oracle 控制台 → 网络 → 安全列表 → 入站规则"
echo "    添加：源 0.0.0.0/0，TCP，目的端口 3000"
echo ""
docker compose ps
