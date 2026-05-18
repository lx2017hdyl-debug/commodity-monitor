# 阿里云部署指南（大宗原材价格监控）

部署到**国内阿里云 ECS** 后，行情由服务器直连东方财富/新浪，比 Vercel 海外节点 + 浏览器拉取快得多。

## 一、购买 ECS（约 5 分钟）

1. 登录 [阿里云控制台](https://ecs.console.aliyun.com/)
2. **创建实例**：
   - 地域：**华东 / 华北**（离同事近即可）
   - 镜像：**Ubuntu 22.04 64 位**
   - 规格：**2 核 2G** 即可（`ecs.t6-c1m2.large` 或同类）
   - 带宽：按量 1～5 Mbps 或固定带宽
   - **安全组**：放行 **22（SSH）**、**3000（应用）**；若用域名 + HTTPS，再放行 **80 / 443**
3. 设置 root 密码或绑定 SSH 密钥，记下 **公网 IP**

## 二、一键部署（在 ECS 上执行）

SSH 登录后执行：

```bash
ssh root@你的ECS公网IP

# 方式 A：从 GitHub 克隆并部署（推荐）
apt-get update && apt-get install -y git
git clone https://github.com/lx2017hdyl-debug/commodity-monitor.git /opt/commodity-monitor
cd /opt/commodity-monitor
bash scripts/deploy-aliyun-ecs.sh
```

或已克隆过，仅更新：

```bash
cd /opt/commodity-monitor
git pull
docker compose build && docker compose up -d
```

## 三、从本机推送部署（可选）

在你 Mac 上（已配置 SSH 免密登录 ECS）：

```bash
cd "/Users/lixuan/Desktop/工作/commodity-monitor"
bash scripts/push-deploy-aliyun.sh root@你的ECS公网IP
```

## 四、不用 Docker：PM2 部署

```bash
cd /opt/commodity-monitor
cp .env.production.example .env.production
npm ci
npm run build
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```

`ecosystem.config.cjs` 已设置 `NEXT_PUBLIC_DATA_MODE=server`。

## 五、绑定域名与 HTTPS（可选）

1. 域名解析 A 记录 → ECS 公网 IP
2. 安装 Nginx，反代到 `127.0.0.1:3000`
3. 使用 certbot 或阿里云免费证书配置 HTTPS

示例 Nginx 片段见 `scripts/nginx-commodity-monitor.conf`。

## 六、分享给同事

- 直接发：`http://<ECS公网IP>:3000`
- 或域名：`https://你的域名`
- **无需你的电脑在线**，ECS 24 小时运行

## 七、与 Vercel 的区别

| 项目 | Vercel | 阿里云 ECS |
|------|--------|------------|
| 数据拉取 | 浏览器 script（慢、易失败） | 服务器东财/新浪（快） |
| 环境变量 | 默认 browser | `NEXT_PUBLIC_DATA_MODE=server` |
| 费用 | 免费额度 | ECS 约几十元/月起 |

## 八、常见问题

**安全组已放行仍打不开**  
检查 ECS 防火墙：`ufw allow 3000`

**无数据**  
在 ECS 上测试：`curl -s http://127.0.0.1:3000/api/quotes | head`  
若本机有数据、外网无，则是安全组或防火墙问题。

**更新代码**  
`git pull && docker compose up -d --build`
