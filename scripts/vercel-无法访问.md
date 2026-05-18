# Vercel 链接打不开（ERR_CONNECTION_TIMED_OUT）

## 原因

**不是网站坏了。** 境外检测 `https://commodity-monitor.vercel.app` 可正常打开并有行情数据。

你公司/当前网络 **拦截了 Vercel 的 IP**（`*.vercel.app`），浏览器会显示「响应时间过长」。

常见情况：企业防火墙、代理、部分地区运营商对海外 CDN 不稳定。

## 快速自测

1. 用手机 **4G/5G 热点**（关 WiFi）再打开同一链接  
   - 能打开 → 就是公司网拦了 Vercel  
   - 仍打不开 → 再查 Vercel 部署是否失败  

2. 登录 https://vercel.com → 项目 **Deployments** 是否为绿色 **Ready**

---

## 免费替代方案（推荐顺序）

### 方案 A：公司内网（最快，0 元）

适合同事都在办公室、同一局域网：

```bash
cd "/Users/lixuan/Desktop/工作/commodity-monitor"
npm ci && NEXT_PUBLIC_DATA_MODE=server npm run build
npm run start:intranet
```

同事访问：`http://你的内网IP:3000`（`ipconfig getifaddr en0` 查看 IP）

### 方案 B：Cloudflare 隧道（0 元，外网也能看）

适合公司网拦 Vercel，但本机能访问东财：

```bash
cd "/Users/lixuan/Desktop/工作/commodity-monitor"
npm run share:tunnel
```

终端里会出现 `https://xxxx.trycloudflare.com`，发给同事。**你的电脑需保持开机运行。**

### 方案 C：继续用 Vercel

在家/手机热点/未拦 Vercel 的网络下仍可访问原链接。

---

## 长期稳定 + 免费

- **Oracle 永久免费 VPS**：见 `scripts/deploy-oracle.md`  
- **阿里云试用**：见 `scripts/deploy-aliyun.md`
