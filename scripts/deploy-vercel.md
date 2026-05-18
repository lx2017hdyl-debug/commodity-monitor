# Vercel 部署步骤（已优化速度）

部署后行情由 **Vercel 香港节点服务端** 调用东方财富 API（比浏览器拉新浪 script 快很多），首页约 **60 秒** 缓存刷新。

## 1. 推送代码到 GitHub

```bash
cd "/Users/lixuan/Desktop/工作/commodity-monitor"
git add .
git commit -m "更新说明"
git push
```

## 2. 在 Vercel 部署 / 更新

1. 打开 https://vercel.com → 你的 `commodity-monitor` 项目
2. 若首次部署：**Add New → Project** → 选仓库 → **Deploy**
3. 若已部署：`git push` 后会自动重新部署

## 3. 环境变量（一般不用手填）

项目已在 `vercel.json` 配置：

- `NEXT_PUBLIC_DATA_MODE=server`（走服务端 API）
- 区域 `hkg1`（香港，便于访问东财）

若 Vercel 控制台里曾手动设过别的值，请到 **Settings → Environment Variables** 确认：

| 变量 | 值 |
|------|-----|
| `NEXT_PUBLIC_DATA_MODE` | `server` |

## 4. 发给同事

`https://你的项目.vercel.app`

## 5. 速度说明

| 优化项 | 效果 |
|--------|------|
| 服务端东财 API | 一次请求拿齐 12 个品种 |
| 首页 SSR + 60s 缓存 | 打开即显示价格 |
| 详情页预渲染 | 点进品种更快 |
| 浏览器 session 缓存 | 刷新页面秒开 |

## 6. 若无数据

1. Vercel → **Settings → Functions → Function Region** 确认含 **Hong Kong (hkg1)**
2. 打开 `https://你的域名/api/quotes` 看是否有 JSON
3. 重新 **Deployments → Redeploy**
