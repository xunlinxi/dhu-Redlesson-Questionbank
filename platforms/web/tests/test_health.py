"""基本健康检查测试，确保服务能启动核心路由。"""

from backend.app import app


def test_health_endpoint():
    client = app.test_client()
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert data["status"] == "online"
