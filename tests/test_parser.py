import json, datetime, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))
from sheet_parser import excel_serial_to_date, parse_sheet

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
    assert len(recs) == 27  # 9 天 × 3 段
    tw_ios = [r for r in recs if r["country"] == "台湾" and r["device"] == "ios"]
    assert len(tw_ios) == 9  # 国家向下填充生效
    r0 = recs[0]
    assert set(r0) >= {"date", "country", "device", "meta_spend", "meta_roas",
                       "adjust_spend", "d0_roas", "d3_roas", "d7_roas"}


def test_immature_roas_is_null():
    out = parse_sheet(_values())
    latest = [r for r in out["records"] if r["date"] == "2026-06-03"]
    assert latest and all(r["d7_roas"] is None for r in latest)


def test_known_value():
    out = parse_sheet(_values())
    kr = [r for r in out["records"]
          if r["date"] == "2026-06-03" and r["country"] == "韩国" and r["device"] == "安卓"][0]
    assert round(kr["adjust_spend"], 2) == 3803.79
    assert round(kr["d0_roas"], 4) == 0.5056
