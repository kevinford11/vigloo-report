# 手游日报 Dashboard

飞书「手游日报」每日自动抓取 + 公开可视化报表。浅色简洁风,支持日期/国家/设备过滤,默认最近 7 天。

## 本地运行

1. `pip install -r requirements.txt`
2. 设环境变量 `LARK_APP_ID` / `LARK_APP_SECRET`
3. `python fetch_data.py` → 生成 `public/data.json`
4. `cd public && python -m http.server 8000` → 浏览器打开 http://localhost:8000

## 自动化

GitHub Actions 每天 UTC 01:00(北京 09:00)抓取并部署到 GitHub Pages。
凭证存仓库 Secret:`LARK_APP_ID`、`LARK_APP_SECRET`。

## 结构

- `lark_client.py` — 飞书 API 封装(token / 解析 wiki / 读表)
- `parser.py` — 纯函数解析器(Sheet 二维数组 → 结构化数据)
- `fetch_data.py` — 编排:抓取 → 解析 → 写 `public/data.json`
- `public/` — 静态报表(index.html / style.css / app.js / data.json)
- `tests/` — 解析器单元测试(真实样本)
