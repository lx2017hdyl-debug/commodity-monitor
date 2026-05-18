# Vercel 部署步骤（约 10 分钟）

## 1. 推送代码到 GitHub

1. 打开 https://github.com/new 创建仓库，名称例如 `commodity-monitor`，选 **Private** 或 Public
2. **不要**勾选「Add README」（本地已有代码）
3. 在终端执行（把 `你的用户名` 换成你的 GitHub 用户名）：

```bash
cd "/Users/lixuan/Desktop/工作/commodity-monitor"
git remote add origin https://github.com/你的用户名/commodity-monitor.git
git branch -M main
git push -u origin main
```

## 2. 在 Vercel 部署

1. 打开 https://vercel.com 用 GitHub 账号登录
2. 点击 **Add New → Project**
3. 选择刚推送的 `commodity-monitor` 仓库 → **Import**
4. 保持默认配置（Framework: Next.js），点击 **Deploy**
5. 等待 2～3 分钟，得到地址如 `https://commodity-monitor-xxx.vercel.app`

## 3. 发给同事

把 Vercel 给的 `https://xxx.vercel.app` 链接发给同事即可，**无需你的电脑在线**。

## 4. 以后更新网站

改完代码后：

```bash
git add .
git commit -m "更新说明"
git push
```

Vercel 会自动重新部署。

## 注意

- 已配置香港节点（`hkg1`），便于访问新浪行情接口
- 若部署后无数据，在 Vercel 项目 → Settings → Functions → Region 确认包含 Hong Kong
