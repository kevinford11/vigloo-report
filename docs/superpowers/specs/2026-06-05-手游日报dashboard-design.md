# 手游日报 Dashboard — 设计文档

日期:2026-06-05
状态:已与用户确认,进入实现

## 1. 目标

把飞书「手游日报」表格的数据**每天自动抓取一次**,整理成一个**漂亮的、可对外展示的网页报表**,带趋势图,支持**日期 / 国家 / 设备**过滤,默认显示最近 7 天。发布到免费托管(GitHub Pages),拿到公开网址。

## 2. 数据源(已实地验证)

- 飞书国际版 wiki 页面 → 底层是一张 **Sheet**(标题「手游日报」)。
- 开放平台 API 基址:`https://open.larksuite.com/open-apis`(Singapore 区)。
- 关键标识:
  - wiki node token:`OlO8wPT3eid2TIkCLr0l5I3rg5e`
  - 解析得到 sheet obj_token:`LfO1scFw3hmKfetxA3JlwEwkglc`
  - 工作表 sheet_id:`699713`(标题 Sheet1)
- 访问方式:自建应用 `cli_aaa899e68b795ed3`(报表读取应用)→ 换 tenant_access_token → 读表。已验证可读(机器人只读权限即可,永不写源表)。

### 表格结构(分组式日报)

- 前 2 行为合并表头。列布局:
  - A 日期 | B 国家 | C 设备
  - D-E:**META** → 花费、ROAS
  - F-I:**中国团队 ADJUST** → 花费、D0 ROAS、D3 ROAS、D7 ROAS
- 顶部「总数据(5.26~昨日)」为**累计块**(B 列=合计),单独用于 KPI,不进趋势。
- 之后每个日期一个区块:1 行「合计」+ 3 行明细段:**韩国-安卓、台湾-安卓、台湾-ios**。
- 维度取值:国家 = {韩国, 台湾};设备 = {安卓, ios}(韩国仅安卓)。
- 日期为 Excel 序列号(如 46176),需转标准日期。
- 合并单元格:日期(A)、国家(B,台湾跨安卓/ios)只在区块首格有值,需**向下填充**。
- 合计行花费为 `SUM()` 公式 → 抓取时取计算值或由明细段自行加总。
- **D3/D7 ROAS 未成熟时为空** → 存 `null`,趋势线自然断开,不画成 0。

## 3. 架构(零成本零运维)

```
飞书 Sheet ──每天定时──> GitHub Actions(fetch_data.py)──> GitHub Pages(静态网页 + data.json)
```

- fetch_data.py:换 token → 解析 wiki → 读全量 → 解析分组结构 → 生成 `public/data.json`。
- 静态网页(index.html + ECharts CDN)读取 data.json,**浏览器端**做日期/国家/设备过滤并画图。
- App ID/Secret 存 GitHub 加密 Secret;wiki/sheet token 非敏感,放配置。
- data.json 同时留存在仓库,作为备份/历史快照(防源表被改丢数据)。

## 4. 数据模型(public/data.json)

```json
{
  "meta": {
    "updated": "2026-06-05T01:00:00Z",
    "date_min": "2026-05-26",
    "date_max": "2026-06-03",
    "countries": ["韩国", "台湾"],
    "devices": ["安卓", "ios"]
  },
  "cumulative": { "meta_spend": 55824.94, "meta_roas": 1.0616,
                  "adjust_spend": 54522.97, "d0_roas": 0.4671, "d3_roas": 0.7668, "d7_roas": 0.8062 },
  "records": [
    { "date": "2026-05-26", "country": "韩国", "device": "安卓",
      "meta_spend": 2806.72, "meta_roas": 0.9234,
      "adjust_spend": 83.38, "d0_roas": 2.2773, "d3_roas": 5.352, "d7_roas": 7.316 }
  ]
}
```

- `records` 为明细段级别(date × country × device),同时含 META 与 ADJUST 指标。
- 未成熟指标值为 `null`。

## 5. 报表页面(浅色简洁商务风,响应式)

- **顶栏**:标题 + 数据更新时间 + 覆盖日期范围。
- **筛选区**:日期范围(默认最近 7 天)、国家多选、设备多选、来源切换(META / ADJUST / 两者)。
- **KPI 卡片**:区间总花费、最新一天花费、最新 D0 ROAS、最新成熟 D7 ROAS,带环比箭头。
- **核心图(花费 vs ROAS 组合)**:柱=花费、线=ROAS(D0/D3/D7 可切),双 Y 轴,x=日期。
- **META vs ADJUST 对比**:花费与 ROAS 并排。
- **国家/设备拆分**:堆叠柱(花费占比)+ 明细表(标注「未成熟」格)。
- 图表库:ECharts(CDN)。移动端自适应。

## 6. 部署与定时

- 新建公开 GitHub 仓库(账号 kevinford11)→ 开 Pages → 公开网址 `https://kevinford11.github.io/<repo>`。
- Actions cron 每天约**北京时间 09:00**(UTC 01:00)抓取并发布(可调)。
- Secret:`LARK_APP_ID`、`LARK_APP_SECRET`。

## 7. 测试

- 以真实抓取样本为 fixture,给解析器写单元测试:行数、Excel 日期换算、未成熟 null、合并单元格向下填充、合计加总,均验证。

## 8. 已确认的默认值

- 仓库:**公开**(Pages 最省事;Secret 仍加密)。
- 定时:北京时间 09:00。
- 来源:默认 META + ADJUST 两者都展示。

## 9. 仓库结构

```
vigloo-report/
  fetch_data.py
  parser.py              # 表格解析(可单测)
  requirements.txt
  config.json            # node_token / sheet_id / API base(非敏感)
  public/
    index.html
    app.js
    style.css
    data.json            # 生成
  tests/
    fixtures/sheet_sample.json
    test_parser.py
  .github/workflows/daily.yml
  README.md
```
