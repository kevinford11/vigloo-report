"""抓取飞书手游日报 -> public/data.json。"""
import json, os, pathlib, datetime
from lark_client import LarkClient
from sheet_parser import parse_sheet

ROOT = pathlib.Path(__file__).parent
OUT = ROOT / "public" / "data.json"


def main():
    cfg = json.load(open(ROOT / "config.json", encoding="utf-8"))
    app_id = os.environ["LARK_APP_ID"]
    app_secret = os.environ["LARK_APP_SECRET"]
    client = LarkClient(app_id, app_secret, cfg["api_base"])

    # wiki 节点解析失败则回退到配置里的 sheet_token
    try:
        sheet_token = client.resolve_wiki_node(cfg["wiki_node_token"]) or cfg["sheet_token"]
    except Exception as e:
        print(f"⚠ wiki 解析失败,回退 config.sheet_token: {e}")
        sheet_token = cfg["sheet_token"]

    values = client.read_values(sheet_token, cfg["sheet_id"], cfg["read_range"])
    data = parse_sheet(values)
    data["meta"]["updated"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    m = data["meta"]
    print(f"✓ 写出 {OUT} | {len(data['records'])} 条 | {m['date_min']}~{m['date_max']}")


if __name__ == "__main__":
    main()
