#!/usr/bin/env bash
# 从 Mac 通过 SSH 部署到 Oracle Cloud 实例
# 用法：bash scripts/push-deploy-oracle.sh ubuntu@你的公网IP
# 若用 Oracle 下载的密钥：bash scripts/push-deploy-oracle.sh -i ~/Downloads/ssh-key-xxx.key ubuntu@IP
set -euo pipefail

SSH_OPTS=()
REMOTE=""

while [ $# -gt 0 ]; do
  case "$1" in
    -i)
      SSH_OPTS+=(-i "$2")
      shift 2
      ;;
    *)
      REMOTE="$1"
      shift
      ;;
  esac
done

if [ -z "${REMOTE}" ]; then
  echo "用法: bash scripts/push-deploy-oracle.sh [-i 私钥文件] ubuntu@公网IP"
  exit 1
fi

APP_DIR="/opt/commodity-monitor"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> 同步代码到 ${REMOTE}:${APP_DIR}..."
ssh "${SSH_OPTS[@]}" "${REMOTE}" "sudo mkdir -p ${APP_DIR} && sudo chown -R \$(whoami):\$(whoami) ${APP_DIR}"
rsync -avz "${SSH_OPTS[@]}" \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  "${ROOT}/" "${REMOTE}:${APP_DIR}/"

echo "==> 远程安装并启动..."
ssh "${SSH_OPTS[@]}" "${REMOTE}" "cd ${APP_DIR} && sudo bash scripts/deploy-oracle-instance.sh"

echo ""
echo "==> 完成。浏览器打开: http://<公网IP>:3000"
