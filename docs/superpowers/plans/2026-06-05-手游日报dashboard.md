# 手游日报 Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每天自动抓取飞书「手游日报」Sheet,解析成 data.json,用浅色简洁的静态网页(ECharts)展示趋势,支持日期/国家/设备过滤,默认最近 7 天,发布到 GitHub Pages 对外公开。

**Architecture:** Python 抓取脚本(token→解析wiki→读表)+ 纯函数解析器(TDD)生成 `public/data.json`;静态前端浏览器端过滤画图;GitHub Actions cron 每日运行并部署 Pages。App 凭证存 GitHub Secret。

**Tech Stack:** Python 3 (requests), ECharts (CDN), 原生 HTML/CSS/JS, GitHub Actions, GitHub Pages。

关键标识(已验证):API 基址 `https://open.larksuite.com/open-apis`;wiki node `OlO8wPT3eid2TIkCLr0l5I3rg5e`;sheet token `LfO1scFw3hmKfetxA3JlwEwkglc`;sheet_id `699713`;app `cli_aaa899e68b795ed3`(只读)。

---

## File Structure

```
vigloo-report/
  config.json            # 非敏感:api_base, wiki_node, 兜底 sheet_token/sheet_id
  requirements.txt       # requests
  lark_client.py         # 飞书 API 薄封装(token / wiki / read values)
  parser.py              # 纯函数:解析 sheet 二维数组 -> {meta,cumulative,records}
  fetch_data.py          # 编排:抓取 -> parser -> 写 public/data.json
  public/
    index.html
    style.css
    app.js               # 加载 data.json + 过滤 + ECharts
    data.json            # 生成物(也提交,做备份)
  tests/
    fixtures/sheet_sample.json   # 真实抓取样本(已存在)
    test_parser.py
  .github/workflows/daily.yml
  README.md
```

职责边界:`parser.py` 不碰网络(可纯单测);`lark_client.py` 只管 HTTP;`fetch_data.py` 编排;`app.js` 只读 data.json。

---

## Task 1: 项目骨架与配置

**Files:**
- Create: `config.json`, `requirements.txt`, `README.md`

- [ ] **Step 1: 写 config.json**

```json
{
  "api_base": "https://open.larksuite.com/open-apis",
  "wiki_node_token": "OlO8wPT3eid2TIkCLr0l5I3rg5e",
  "sheet_token": "LfO1scFw3hmKfetxA3JlwEwkglc",
  "sheet_id": "699713",
  "read_range": "A1:I400"
}
```

- [ ] **Step 2: 写 requirements.txt**

```
requests>=2.31
```

- [ ] **Step 3: 写 README.md(骨架)**

```markdown
# 手游日报 Dashboard
飞书「手游日报」每日自动抓取 + 公开可视化报表。
## 本地运行
1. `pip install -r requirements.txt`
2. 设环境变量 `LARK_APP_ID` / `LARK_APP_SECRET`
3. `python fetch_data.py` → 生成 `public/data.json`
4. `cd public && python -m http.server 8000` → 浏览器打开 http://localhost:8000
## 自动化
GitHub Actions 每天 UTC 01:00(北京 09:00)抓取并部署到 GitHub Pages。
凭证存仓库 Secret:`LARK_APP_ID`、`LARK_APP_SECRET`。
```

- [ ] **Step 4: Commit**

```bash
/opt/homebrew/bin/git add config.json requirements.txt README.md
/opt/homebrew/bin/git commit -m "chore: 项目骨架与配置"
```

---

## Task 2: 解析器 parser.py(TDD 核心)

解析器把 `sheets/v2 values` 返回的二维数组(`UnformattedValue`)转成结构化数据。
样本已在 `tests/fixtures/sheet_sample.json`(`data.valueRange.values`,9 天数据 2026-05-26~06-03)。

**关键规则**(均来自真实数据):
- 表头 2 行跳过。
- A 列:字符串含「总数据」→ 累计块;数字(Excel 序列号)→ 新日期块;`None` → 沿用当前块。
- B 列「合计」→ 聚合行(累计块用它取 cumulative;日期块跳过,前端自行加总)。
- 段行国家可能为 `None`(台湾跨 安卓/ios 合并)→ 向当前块**向下填充**国家。
- Excel 序列号→日期:`date(1899,12,30)+timedelta(days=serial)`。
- 列序:`0日期 1国家 2设备 3 META花费 4 META_ROAS 5 ADJUST花费 6 D0 7 D3 8 D7`。
- 空值(`None` 或 `""`)→ `null`(尤其未成熟 D3/D7)。

**Files:**
- Create: `parser.py`, `tests/test_parser.py`

- [ ] **Step 1: 写失败测试 tests/test_parser.py**

```python
import json, datetime, pathlib
from parser import excel_serial_to_date, parse_sheet

FIX = pathlib.Path(__file__).parent / "fixtures" / "sheet_sample.json"

def _values():
    d = json.load(open(FIX, encoding="utf-8"))
    return d["data"]["valueRange"]["values"]

def test_excel_serial_to_date():
    assert excel_serial_to_date(46176) == datetime.date(2026, 6, 3)
    assert excel_serial_to_date(46168) == datetime.date(2026, 5, 26)

def test_parse_meta():
    out = parse_sheet(_values())
    assert out["meta"]["date_min"] == "2026-05-26"
    assert out["meta"]["date_max"] == "2026-06-03"
    assert set(out["meta"]["countries"]) == {"韩国", "台湾"}
    assert set(out["meta"]["devices"]) == {"安卓", "ios"}

def test_parse_cumulative():
    out = parse_sheet(_values())
    c = out["cumulative"]
    assert round(c["adjust_spend"], 2) == 54522.97
    assert round(c["meta_spend"], 2) == 55824.94

def test_records_shape_and_fill():
    out = parse_sheet(_values())
    recs = out["records"]
    # 9 天 × 3 段 = 27 条
    assert len(recs) == 27
    # 国家向下填充:台湾-ios 的 country 不为空
    tw_ios = [r for r in recs if r["country"] == "台湾" and r["device"] == "ios"]
    assert len(tw_ios) == 9
    # 段行字段齐全
    r0 = recs[0]
    assert set(r0) >= {"date","country","device","meta_spend","meta_roas",
                       "adjust_spend","d0_roas","d3_roas","d7_roas"}

def test_immature_roas_is_null():
    out = parse_sheet(_values())
    # 最新日期 2026-06-03 的 D3/D7 应为 None(未成熟)
    latest = [r for r in out["records"] if r["date"] == "2026-06-03"]
    assert latest and all(r["d7_roas"] is None for r in latest)

def test_known_value():
    out = parse_sheet(_values())
    kr = [r for r in out["records"]
          if r["date"] == "2026-06-03" and r["country"] == "韩国" and r["device"] == "安卓"][0]
    assert round(kr["adjust_spend"], 2) == 3803.79
    assert round(kr["d0_roas"], 4) == 0.5056
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd vigloo-report && python -m pytest tests/test_parser.py -v`
Expected: FAIL(`ModuleNotFoundError: parser` 或函数未定义)

- [ ] **Step 3: 写 parser.py**

```python
"""解析飞书「手游日报」Sheet 二维数组为结构化数据。纯函数,无网络。"""
import datetime

EPOCH = datetime.date(1899, 12, 30)  # Excel 1900 日期系统(含闰年 bug 偏移)
COUNTRIES = {"韩国", "台湾"}


def excel_serial_to_date(serial):
    return EPOCH + datetime.timedelta(days=int(serial))


def _num(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _seg_record(date_str, country, device, row):
    return {
        "date": date_str,
        "country": country,
        "device": device,
        "meta_spend": _num(row[3]) if len(row) > 3 else None,
        "meta_roas": _num(row[4]) if len(row) > 4 else None,
        "adjust_spend": _num(row[5]) if len(row) > 5 else None,
        "d0_roas": _num(row[6]) if len(row) > 6 else None,
        "d3_roas": _num(row[7]) if len(row) > 7 else None,
        "d7_roas": _num(row[8]) if len(row) > 8 else None,
    }


def parse_sheet(values):
    rows = values[2:]  # 跳过 2 行表头
    records = []
    cumulative = {}
    cur_date = None          # 当前日期块的日期字符串(None=累计块)
    cur_country = None       # 向下填充用
    mode = None              # "cumulative" | "daily"

    for row in rows:
        if not row or all(c is None or c == "" for c in row):
            continue
        a = row[0] if len(row) > 0 else None
        b = row[1] if len(row) > 1 else None
        c = row[2] if len(row) > 2 else None

        # A 列决定块边界
        if isinstance(a, str) and "总数据" in a:
            mode = "cumulative"; cur_date = None; cur_country = None
        elif isinstance(a, (int, float)) and not isinstance(a, bool):
            mode = "daily"
            cur_date = excel_serial_to_date(a).isoformat()
            cur_country = None

        # 合计行
        if b == "合计":
            if mode == "cumulative":
                cumulative = {
                    "meta_spend": _num(row[3]) if len(row) > 3 else None,
                    "meta_roas": _num(row[4]) if len(row) > 4 else None,
                    "adjust_spend": _num(row[5]) if len(row) > 5 else None,
                    "d0_roas": _num(row[6]) if len(row) > 6 else None,
                    "d3_roas": _num(row[7]) if len(row) > 7 else None,
                    "d7_roas": _num(row[8]) if len(row) > 8 else None,
                }
            continue  # 日期合计行跳过(前端自行加总)

        # 段行:国家向下填充
        if b in COUNTRIES:
            cur_country = b
        country = cur_country
        device = c
        if country and device:
            records.append(_seg_record(cur_date or "cumulative", country, device, row))

    daily = [r for r in records if r["date"] != "cumulative"]
    dates = sorted({r["date"] for r in daily})
    meta = {
        "date_min": dates[0] if dates else None,
        "date_max": dates[-1] if dates else None,
        "countries": sorted({r["country"] for r in daily}),
        "devices": sorted({r["device"] for r in daily}),
    }
    return {"meta": meta, "cumulative": cumulative, "records": daily}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `python -m pytest tests/test_parser.py -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
/opt/homebrew/bin/git add parser.py tests/
/opt/homebrew/bin/git commit -m "feat: sheet 解析器 + 单元测试(真实样本)"
```

---

## Task 3: 飞书客户端 lark_client.py

**Files:**
- Create: `lark_client.py`

- [ ] **Step 1: 写 lark_client.py**

```python
"""飞书开放平台薄封装。"""
import requests


class LarkClient:
    def __init__(self, app_id, app_secret, api_base):
        self.app_id = app_id
        self.app_secret = app_secret
        self.api_base = api_base.rstrip("/")
        self._token = None

    def _tok(self):
        if self._token:
            return self._token
        r = requests.post(
            f"{self.api_base}/auth/v3/tenant_access_token/internal",
            json={"app_id": self.app_id, "app_secret": self.app_secret},
            timeout=30,
        )
        r.raise_for_status()
        d = r.json()
        if d.get("code") != 0:
            raise RuntimeError(f"token 失败: {d}")
        self._token = d["tenant_access_token"]
        return self._token

    def _headers(self):
        return {"Authorization": f"Bearer {self._tok()}"}

    def resolve_wiki_node(self, node_token):
        """返回底层文档 obj_token(失败抛错)。"""
        r = requests.get(
            f"{self.api_base}/wiki/v2/spaces/get_node",
            params={"token": node_token}, headers=self._headers(), timeout=30,
        )
        r.raise_for_status()
        d = r.json()
        if d.get("code") != 0:
            raise RuntimeError(f"解析 wiki 失败: {d}")
        return d["data"]["node"]["obj_token"]

    def read_values(self, sheet_token, sheet_id, rng):
        r = requests.get(
            f"{self.api_base}/sheets/v2/spreadsheets/{sheet_token}/values/{sheet_id}!{rng}",
            params={"valueRenderOption": "UnformattedValue"},
            headers=self._headers(), timeout=30,
        )
        r.raise_for_status()
        d = r.json()
        if d.get("code") != 0:
            raise RuntimeError(f"读表失败: {d}")
        return d["data"]["valueRange"]["values"]
```

- [ ] **Step 2: 冒烟验证(用真实凭证,临时)**

Run:
```bash
cd vigloo-report
export LARK_APP_ID=$(grep '^APP_ID=' ../lark_creds.txt | cut -d= -f2)
export LARK_APP_SECRET=$(grep '^APP_SECRET=' ../lark_creds.txt | cut -d= -f2)
python -c "
import json,os
from lark_client import LarkClient
cfg=json.load(open('config.json'))
c=LarkClient(os.environ['LARK_APP_ID'],os.environ['LARK_APP_SECRET'],cfg['api_base'])
print('obj_token=',c.resolve_wiki_node(cfg['wiki_node_token']))
v=c.read_values(cfg['sheet_token'],cfg['sheet_id'],cfg['read_range'])
print('rows=',len(v))
"
```
Expected: 打印 obj_token 与 rows 数(>40)。

- [ ] **Step 3: Commit**

```bash
/opt/homebrew/bin/git add lark_client.py
/opt/homebrew/bin/git commit -m "feat: 飞书 API 客户端"
```

---

## Task 4: 编排脚本 fetch_data.py

**Files:**
- Create: `fetch_data.py`

- [ ] **Step 1: 写 fetch_data.py**

```python
"""抓取飞书手游日报 -> public/data.json。"""
import json, os, pathlib, datetime
from lark_client import LarkClient
from parser import parse_sheet

ROOT = pathlib.Path(__file__).parent
OUT = ROOT / "public" / "data.json"


def main():
    cfg = json.load(open(ROOT / "config.json", encoding="utf-8"))
    app_id = os.environ["LARK_APP_ID"]
    app_secret = os.environ["LARK_APP_SECRET"]
    client = LarkClient(app_id, app_secret, cfg["api_base"])

    sheet_token = client.resolve_wiki_node(cfg["wiki_node_token"]) or cfg["sheet_token"]
    values = client.read_values(sheet_token, cfg["sheet_id"], cfg["read_range"])

    data = parse_sheet(values)
    data["meta"]["updated"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"写出 {OUT} | {len(data['records'])} 条 | {data['meta']['date_min']}~{data['meta']['date_max']}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 运行生成真实 data.json**

Run:
```bash
cd vigloo-report
export LARK_APP_ID=$(grep '^APP_ID=' ../lark_creds.txt | cut -d= -f2)
export LARK_APP_SECRET=$(grep '^APP_SECRET=' ../lark_creds.txt | cut -d= -f2)
python fetch_data.py
python -c "import json;d=json.load(open('public/data.json'));print('records',len(d['records']));print('meta',d['meta'])"
```
Expected: 打印 records 27、meta 含日期范围与维度。

- [ ] **Step 3: Commit**

```bash
/opt/homebrew/bin/git add fetch_data.py public/data.json
/opt/homebrew/bin/git commit -m "feat: 抓取编排脚本 + 首份 data.json"
```

---

## Task 5: 前端报表(浅色简洁,ECharts)

用 **frontend-design 技能**产出高质量 UI,严格满足下方数据契约与功能清单。data.json 契约见 Task 2 输出与设计文档第 4 节。

**Files:**
- Create: `public/index.html`, `public/style.css`, `public/app.js`

**功能清单(必须全部满足):**
1. 加载同目录 `data.json`(`fetch('data.json')`)。
2. 顶栏:标题「手游日报 Dashboard」+ 数据更新时间(`meta.updated` 本地化)+ 覆盖范围(`date_min~date_max`)。
3. 筛选区(变更即重渲染):
   - 日期范围:两个 date input,**默认 = 最近 7 天**(`[date_max-6, date_max]`,按数据实际范围 clamp)。
   - 国家多选(来自 `meta.countries`),默认全选。
   - 设备多选(来自 `meta.devices`),默认全选。
   - 来源切换:META / ADJUST / 两者,默认「两者」。
4. KPI 卡片(按当前筛选聚合):区间总花费(ADJUST)、最新一天花费、最新 D0 ROAS、最新成熟 D7 ROAS;各带与前一天环比箭头(↑绿/↓红)。
5. 核心组合图:x=日期;柱=花费(按来源),线=ROAS;提供 D0/D3/D7 切换;双 Y 轴。`null` 值断线(`connectNulls:false`)。
6. META vs ADJUST 对比图:两来源花费并排 + ROAS 对比(仅「两者」时显示)。
7. 国家/设备拆分:选定区间内,按 国家×设备 的花费堆叠柱;下方明细表(date/country/device/各指标),未成熟单元格显示「—」并加灰样式。
8. 响应式:窗口 resize 时 `chart.resize()`;手机单列堆叠。
9. 浅色简洁商务风:白底、柔和主色、留白、卡片阴影、ECharts 主色与之协调。

**聚合规则(写进 app.js):**
- 按当前国家/设备/日期过滤 `records`。
- 某日某来源花费 = 过滤后该日所有段 `*_spend` 之和。
- 某日 ROAS = **花费加权平均**(`sum(spend_i*roas_i)/sum(spend_i)`,忽略 `null`),避免简单平均失真。

- [ ] **Step 1: 用 frontend-design 技能产出 index.html + style.css + app.js**(满足上面全部清单)

- [ ] **Step 2: 本地起服务人工验证**

Run: `cd vigloo-report/public && python -m http.server 8000`
然后用 `verify`/浏览器打开 http://localhost:8000,逐条核对功能清单(默认 7 天、三类筛选生效、组合图、对比图、拆分表、断线、响应式)。

- [ ] **Step 3: Commit**

```bash
/opt/homebrew/bin/git add public/index.html public/style.css public/app.js
/opt/homebrew/bin/git commit -m "feat: 浅色报表前端(筛选+组合趋势+对比+拆分)"
```

---

## Task 6: GitHub Actions 每日抓取 + 部署 Pages

**Files:**
- Create: `.github/workflows/daily.yml`

- [ ] **Step 1: 写 .github/workflows/daily.yml**

```yaml
name: daily-report
on:
  schedule:
    - cron: "0 1 * * *"   # UTC 01:00 = 北京 09:00
  workflow_dispatch: {}
permissions:
  contents: write
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r requirements.txt
      - name: Fetch data
        env:
          LARK_APP_ID: ${{ secrets.LARK_APP_ID }}
          LARK_APP_SECRET: ${{ secrets.LARK_APP_SECRET }}
        run: python fetch_data.py
      - name: Commit data.json (历史备份)
        run: |
          git config user.name "github-actions"
          git config user.email "actions@github.com"
          git add public/data.json
          git commit -m "data: 每日更新 $(date -u +%F)" || echo "无变化"
          git push || echo "push 跳过"
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: public }
      - uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
/opt/homebrew/bin/git add .github/workflows/daily.yml
/opt/homebrew/bin/git commit -m "ci: 每日抓取并部署 GitHub Pages"
```

---

## Task 7: 发布上线

- [ ] **Step 1: 建远程公开仓库并推送**

Run:
```bash
cd vigloo-report
~/.local/bin/gh repo create vigloo-report --public --source=. --remote=origin --push
```

- [ ] **Step 2: 设置 Secret**

Run:
```bash
~/.local/bin/gh secret set LARK_APP_ID --body "$(grep '^APP_ID=' ../lark_creds.txt | cut -d= -f2)"
~/.local/bin/gh secret set LARK_APP_SECRET --body "$(grep '^APP_SECRET=' ../lark_creds.txt | cut -d= -f2)"
```

- [ ] **Step 3: 开启 Pages 为 GitHub Actions 源**

Run:
```bash
~/.local/bin/gh api -X POST repos/kevinford11/vigloo-report/pages -f build_type=workflow || \
~/.local/bin/gh api -X PUT repos/kevinford11/vigloo-report/pages -f build_type=workflow
```

- [ ] **Step 4: 触发并验证**

Run:
```bash
~/.local/bin/gh workflow run daily-report
sleep 60 && ~/.local/bin/gh run list --workflow=daily-report --limit 1
```
Expected: 最近一次 run 成功;访问 `https://kevinford11.github.io/vigloo-report/` 能看到报表。

- [ ] **Step 5: 把公开网址写进 README 顶部并提交**

```bash
/opt/homebrew/bin/git pull --rebase
# 在 README 顶部加一行:在线地址 https://kevinford11.github.io/vigloo-report/
/opt/homebrew/bin/git add README.md && /opt/homebrew/bin/git commit -m "docs: 在线地址" && /opt/homebrew/bin/git push
```

---

## Self-Review 备注

- Spec 覆盖:抓取(T3/T4)、解析(T2)、data.json(T2/T4)、报表+筛选+趋势(T5)、部署定时(T6)、发布(T7)、测试(T2)、累计 KPI(T2 cumulative)。
- 类型一致:`parse_sheet` 返回 `{meta,cumulative,records}`,前端契约一致;字段名 `meta_spend/meta_roas/adjust_spend/d0_roas/d3_roas/d7_roas` 全程统一。
- 未成熟值统一 `null`,前端断线 + 表格「—」。
```
