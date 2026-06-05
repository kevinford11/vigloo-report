"""解析飞书「手游日报」Sheet 二维数组为结构化数据。纯函数,无网络。

列序(UnformattedValue):
  0 日期  1 国家  2 设备  3 META花费  4 META_ROAS
  5 ADJUST花费  6 D0 ROAS  7 D3 ROAS  8 D7 ROAS
"""
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


def _metrics(row):
    g = lambda i: row[i] if len(row) > i else None
    return {
        "meta_spend": _num(g(3)),
        "meta_roas": _num(g(4)),
        "adjust_spend": _num(g(5)),
        "d0_roas": _num(g(6)),
        "d3_roas": _num(g(7)),
        "d7_roas": _num(g(8)),
    }


def parse_sheet(values):
    rows = values[2:]  # 跳过 2 行表头
    records = []
    totals = []           # 每个日期的「合计行」(权威聚合,口径对齐原表)
    cumulative = {}
    cur_date = None       # 当前日期块的日期字符串(None=累计块)
    cur_country = None    # 向下填充用
    mode = None           # "cumulative" | "daily"

    for row in rows:
        if not row or all(c is None or c == "" for c in row):
            continue
        a = row[0] if len(row) > 0 else None
        b = row[1] if len(row) > 1 else None
        c = row[2] if len(row) > 2 else None

        # A 列决定块边界
        if isinstance(a, str) and "总数据" in a:
            mode, cur_date, cur_country = "cumulative", None, None
        elif isinstance(a, (int, float)) and not isinstance(a, bool):
            mode = "daily"
            cur_date = excel_serial_to_date(a).isoformat()
            cur_country = None

        # 合计行
        if b == "合计":
            if mode == "cumulative":
                cumulative = _metrics(row)
            elif mode == "daily" and cur_date:
                totals.append({"date": cur_date, **_metrics(row)})
            continue  # 不进 records(明细),单独存 totals

        # 段行:国家向下填充
        if b in COUNTRIES:
            cur_country = b
        country, device = cur_country, c
        if country and device:
            rec = {"date": cur_date or "cumulative", "country": country, "device": device}
            rec.update(_metrics(row))
            records.append(rec)

    daily = [r for r in records if r["date"] != "cumulative"]
    dates = sorted({r["date"] for r in daily})
    meta = {
        "date_min": dates[0] if dates else None,
        "date_max": dates[-1] if dates else None,
        "countries": sorted({r["country"] for r in daily}),
        "devices": sorted({r["device"] for r in daily}),
    }
    return {"meta": meta, "cumulative": cumulative, "totals": totals, "records": daily}
