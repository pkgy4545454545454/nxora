"""JARVIS API backend tests."""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# --- basic GETs (shape checks) ---
def test_stats_system(s):
    r = s.get(f"{API}/stats/system", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "cpu" in d and "ram" in d and "disk" in d


def test_stats_ai(s):
    r = s.get(f"{API}/stats/ai", timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ("messages", "tool_calls", "errors", "breakdown"):
        assert k in d


def test_commands_recent(s):
    r = s.get(f"{API}/commands/recent", timeout=15)
    assert r.status_code == 200
    assert "commands" in r.json()


def test_commands_quick(s):
    r = s.get(f"{API}/commands/quick", timeout=15)
    assert r.status_code == 200
    assert len(r.json()["commands"]) >= 1


def test_logs(s):
    r = s.get(f"{API}/logs", timeout=15)
    assert r.status_code == 200
    assert "logs" in r.json()


def test_devices(s):
    r = s.get(f"{API}/devices", timeout=15)
    assert r.status_code == 200


def test_applications(s):
    r = s.get(f"{API}/applications", timeout=15)
    assert r.status_code == 200


def test_cyber_tools(s):
    r = s.get(f"{API}/cyber/tools", timeout=15)
    assert r.status_code == 200


def test_gmail_status(s):
    r = s.get(f"{API}/gmail/status", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d.get("configured") is True


def test_whatsapp_recent(s):
    r = s.get(f"{API}/whatsapp/recent", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d.get("mocked") is True
    assert len(d["messages"]) >= 1


def test_oauth_gmail_login_redirect(s):
    r = s.get(f"{API}/oauth/gmail/login", timeout=15, allow_redirects=False)
    # 302/307 redirect to google
    assert r.status_code in (302, 307)
    assert "accounts.google.com" in r.headers.get("location", "")


# --- config ---
def test_config_no_raw_key(s):
    r = s.get(f"{API}/config", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "anthropic_api_key_set" in d
    assert "anthropic_api_key" not in d
    assert d["anthropic_api_key_set"] is True


def test_config_put_persist(s):
    r = s.put(f"{API}/config", json={"wake_word": "TEST_jarvis"}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d.get("wake_word") == "TEST_jarvis"
    assert "anthropic_api_key" not in d
    # verify GET
    r2 = s.get(f"{API}/config", timeout=15)
    assert r2.json().get("wake_word") == "TEST_jarvis"


# --- notes CRUD ---
def test_notes_crud(s):
    # create
    r = s.post(f"{API}/notes", json={"title": "TEST_note", "content": "hello", "lang": "text"}, timeout=15)
    assert r.status_code == 200
    note = r.json()
    assert note["title"] == "TEST_note"
    nid = note["id"]

    # list
    r = s.get(f"{API}/notes", timeout=15)
    assert r.status_code == 200
    assert any(n["id"] == nid for n in r.json()["notes"])

    # delete
    r = s.delete(f"{API}/notes/{nid}", timeout=15)
    assert r.status_code == 200

    r = s.get(f"{API}/notes", timeout=15)
    assert not any(n["id"] == nid for n in r.json()["notes"])


# --- chat: expects billing-blocked friendly reply ---
def test_chat_billing_message(s):
    r = s.post(f"{API}/chat", json={"session_id": "TEST_sess", "message": "Bonjour"}, timeout=60)
    assert r.status_code == 200
    d = r.json()
    reply = (d.get("reply") or "").lower()
    # Either billing message OR a normal ok reply if credits exist
    if d.get("billing"):
        assert "crédit" in reply or "anthropic" in reply
    else:
        assert d.get("ok") is True
        assert len(reply) > 0
