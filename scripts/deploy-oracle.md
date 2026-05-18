# Oracle 云「永久免费」部署指南

在 Oracle Always Free 小主机上运行后，行情由**服务器直连**东方财富/新浪（`server` 模式），比 Vercel 快，且**长期 0 元**（在免费额度内）。

---

## 一、注册并创建免费实例（约 15 分钟）

### 1. 注册

1. 打开 https://cloud.oracle.com 注册（需信用卡验证，**不扣费**即可开通 Always Free）
2. 选择 **Home Region**（建议亚太：**Japan East 东京** 或 **South Korea 首尔**，离国内相对近）

### 2. 创建 VM

1. 菜单 **Compute → Instances → Create instance**
2. 名称：`commodity-monitor`
3. **Image**：`Canonical Ubuntu 22.04`（选 **aarch64** / ARM 才能用永久免费套餐）
4. **Shape**：点击 **Change shape**
   - 选 **Ampere** → `VM.Standard.A1.Flex`
   - OCPU：**1**，Memory：**6 GB**（在免费额度内）
5. **Networking**：勾选 **Assign a public IPv4 address**
6. **SSH keys**：选 **Generate a key pair**，下载私钥（如 `ssh-key-2026-xx-xx.key`），妥善保存
7. 点击 **Create**

等待状态变为 **Running**，记下 **Public IP**（公网 IP）。

### 3. 开放安全组端口（必做）

1. 在实例详情页点 **Subnet** 链接 → 进入 **Virtual Cloud Network**
2. 左侧 **Security Lists** → 点默认安全列表
3. **Add Ingress Rules**，添加两条：

| 源 CIDR | 协议 | 目标端口 | 说明 |
|---------|------|----------|------|
| `0.0.0.0/0` | TCP | 22 | SSH |
| `0.0.0.0/0` | TCP | 3000 | 网站 |

保存。

---

## 二、SSH 登录并一键部署

在 Mac 终端（把路径和 IP 换成你的）：

```bash
# 私钥权限（只需一次）
chmod 400 ~/Downloads/ssh-key-2026-xx-xx.key

# 登录（Oracle 默认用户多为 ubuntu）
ssh -i ~/Downloads/ssh-key-2026-xx-xx.key ubuntu@你的公网IP
```

登录后执行：

```bash
sudo apt-get update && sudo apt-get install -y git
sudo git clone https://github.com/lx2017hdyl-debug/commodity-monitor.git /opt/commodity-monitor
cd /opt/commodity-monitor
sudo bash scripts/deploy-oracle-instance.sh
```

部署脚本会自动：开放本机防火墙、安装 Docker、构建并启动。

### 验证

在实例上：

```bash
curl -s http://127.0.0.1:3000/api/quotes | head -c 200
```

有 JSON 输出即成功。浏览器访问：

**http://你的公网IP:3000**

---

## 三、从 Mac 推送更新（可选）

已 SSH 免密或可 `-i` 指定密钥时：

```bash
cd "/Users/lixuan/Desktop/工作/commodity-monitor"
bash scripts/push-deploy-oracle.sh -i ~/Downloads/ssh-key-xxx.key ubuntu@你的公网IP
```

---

## 四、分享给同事

把链接发给同事即可，**无需你的电脑在线**：

`http://<Oracle公网IP>:3000`

---

## 五、以后更新网站

SSH 进实例后：

```bash
cd /opt/commodity-monitor
sudo git pull
sudo docker compose up -d --build
```

---

## 六、常见问题

### 外网打不开，实例里 curl 正常

1. 检查 **Security List** 是否已放行 **3000**
2. 重新执行：`sudo bash /opt/commodity-monitor/scripts/deploy-oracle-instance.sh`（会修复 iptables）

### 构建很慢

ARM 首次 `docker compose build` 约 5～10 分钟，属正常。

### 行情无数据

在实例上测试东财/新浪是否可达：

```bash
curl -sI https://push2.eastmoney.com | head -3
```

若超时，可换 Home Region 为东京/首尔后重建实例。

### 免费额度

Always Free 的 A1 合计 **最多 4 OCPU + 24GB 内存**（可 1 台 4 核，或多台拆分）。本应用 1 OCPU + 6GB 足够。

---

## 七、与 Vercel 对比

| 项目 | Vercel | Oracle 免费主机 |
|------|--------|-----------------|
| 费用 | 免费 | 永久免费（额度内） |
| 行情 | 浏览器拉，慢 | 服务端拉，快 |
| 维护 | 无服务器 | 需自己管一台 VM |
