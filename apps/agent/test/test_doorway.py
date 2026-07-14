from fastapi.testclient import TestClient
import app.main as main
from app.schemas import Findings, ProviderFinding

client = TestClient(main.app)


def test_health():
    assert client.get("/health").json() == {"ok": True}


def test_unknown_agent_404():
    assert client.post("/agents/nope", json={}).status_code == 404


def test_browser_use_dispatch(monkeypatch):
    async def fake_run(data):
        return Findings(
            status="in_network",
            provider=ProviderFinding(name="Dr X", address="1 Main St", city="Santa Cruz", state="CA"),
            scope_hint="network_level",
        )

    monkeypatch.setitem(
        main.REGISTRY, "browser_use", (main.REGISTRY["browser_use"][0], fake_run)
    )
    res = client.post("/agents/browser_use", json={"prompt": "Go to http://x and find Dr X"})
    assert res.status_code == 200
    assert res.json()["status"] == "in_network"
