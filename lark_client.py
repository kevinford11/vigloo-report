"""飞书开放平台薄封装:换 token / 解析 wiki 节点 / 读电子表格。"""
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
            raise RuntimeError(f"换取 token 失败: {d}")
        self._token = d["tenant_access_token"]
        return self._token

    def _headers(self):
        return {"Authorization": f"Bearer {self._tok()}"}

    def resolve_wiki_node(self, node_token):
        """wiki 节点 -> 底层文档 obj_token。"""
        r = requests.get(
            f"{self.api_base}/wiki/v2/spaces/get_node",
            params={"token": node_token}, headers=self._headers(), timeout=30,
        )
        r.raise_for_status()
        d = r.json()
        if d.get("code") != 0:
            raise RuntimeError(f"解析 wiki 节点失败: {d}")
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
            raise RuntimeError(f"读取表格失败: {d}")
        return d["data"]["valueRange"]["values"]
