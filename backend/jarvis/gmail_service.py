"""Gmail OAuth + read recent emails (personal, single-owner)."""
import os
import base64
import warnings
from datetime import datetime, timezone

from jarvis.store import db, update_config

OWNER = "owner"
SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.labels",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.send",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]


def _creds_configured() -> bool:
    return bool(os.environ.get("GOOGLE_CLIENT_ID") and os.environ.get("GOOGLE_CLIENT_SECRET"))


def _client_config():
    return {"web": {
        "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
        "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
    }}


def _redirect_uri() -> str:
    return os.environ.get("GMAIL_REDIRECT_URI", "")


async def status() -> dict:
    if not _creds_configured():
        return {"configured": False, "connected": False,
                "message": "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants."}
    token = await db.gmail_tokens.find_one({"user_id": OWNER})
    return {"configured": True, "connected": bool(token), "email": (token or {}).get("email")}


async def login_url() -> dict:
    if not _creds_configured():
        return {"ok": False, "error": "Identifiants Google non configurés."}
    from google_auth_oauthlib.flow import Flow
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=_redirect_uri())
    url, state = flow.authorization_url(access_type="offline", prompt="consent", include_granted_scopes="true")
    await db.oauth_states.update_one({"state": state}, {"$set": {"state": state, "ts": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return {"ok": True, "url": url}


async def handle_callback(code: str, state: str) -> bool:
    from google_auth_oauthlib.flow import Flow
    from googleapiclient.discovery import build
    st = await db.oauth_states.find_one({"state": state})
    if not st:
        return False
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=_redirect_uri())
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        flow.fetch_token(code=code)
    creds = flow.credentials
    email = None
    try:
        info = build("oauth2", "v2", credentials=creds).userinfo().get().execute()
        email = info.get("email")
    except Exception:
        pass
    await db.gmail_tokens.update_one({"user_id": OWNER}, {"$set": {
        "user_id": OWNER, "email": email,
        "access_token": creds.token, "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri, "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "expires_at": creds.expiry.replace(tzinfo=timezone.utc).isoformat() if creds.expiry else None,
    }}, upsert=True)
    await db.oauth_states.delete_one({"state": state})
    await update_config({"gmail_connected": True})
    return True


async def _service():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request as GoogleRequest
    from googleapiclient.discovery import build
    token = await db.gmail_tokens.find_one({"user_id": OWNER})
    if not token:
        return None
    creds = Credentials(
        token=token["access_token"], refresh_token=token.get("refresh_token"),
        token_uri=token["token_uri"], client_id=token["client_id"],
        client_secret=token["client_secret"], scopes=SCOPES)
    exp = token.get("expires_at")
    needs_refresh = True
    if exp:
        dt = datetime.fromisoformat(exp)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        needs_refresh = datetime.now(timezone.utc) >= dt
    if needs_refresh and token.get("refresh_token"):
        creds.refresh(GoogleRequest())
        await db.gmail_tokens.update_one({"user_id": OWNER}, {"$set": {
            "access_token": creds.token,
            "expires_at": creds.expiry.replace(tzinfo=timezone.utc).isoformat() if creds.expiry else None}})
    return build("gmail", "v1", credentials=creds)


def _header(payload, name):
    for h in payload.get("headers", []):
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


async def recent(max_results: int = 8) -> dict:
    svc = await _service()
    if not svc:
        return {"ok": False, "connected": False, "emails": []}
    listing = svc.users().messages().list(userId="me", maxResults=max_results, labelIds=["INBOX"]).execute()
    emails = []
    for m in listing.get("messages", []):
        msg = svc.users().messages().get(userId="me", id=m["id"], format="metadata",
                                         metadataHeaders=["From", "Subject", "Date"]).execute()
        payload = msg.get("payload", {})
        emails.append({
            "id": m["id"], "from": _header(payload, "From"),
            "subject": _header(payload, "Subject") or "(sans objet)",
            "date": _header(payload, "Date"), "snippet": msg.get("snippet", ""),
            "unread": "UNREAD" in msg.get("labelIds", []),
        })
    return {"ok": True, "connected": True, "emails": emails}


def _extract_body(payload) -> str:
    import base64 as _b64

    def decode(data):
        return _b64.urlsafe_b64decode(data.encode("utf-8")).decode("utf-8", errors="replace")

    if payload.get("body", {}).get("data"):
        return decode(payload["body"]["data"])
    for part in payload.get("parts", []) or []:
        mime = part.get("mimeType", "")
        if mime == "text/plain" and part.get("body", {}).get("data"):
            return decode(part["body"]["data"])
        nested = _extract_body(part)
        if nested:
            return nested
    return ""


async def search(query: str, max_results: int = 5) -> dict:
    svc = await _service()
    if not svc:
        return {"ok": False, "connected": False, "emails": []}
    listing = svc.users().messages().list(userId="me", q=query, maxResults=max_results).execute()
    emails = []
    for m in listing.get("messages", []):
        msg = svc.users().messages().get(userId="me", id=m["id"], format="full").execute()
        payload = msg.get("payload", {})
        emails.append({
            "id": m["id"], "from": _header(payload, "From"),
            "subject": _header(payload, "Subject") or "(sans objet)",
            "date": _header(payload, "Date"), "snippet": msg.get("snippet", ""),
            "body": _extract_body(payload)[:4000],
        })
    return {"ok": True, "connected": True, "emails": emails, "count": len(emails)}


async def get_message(message_id: str) -> dict:
    svc = await _service()
    if not svc:
        return {"ok": False, "connected": False}
    msg = svc.users().messages().get(userId="me", id=message_id, format="full").execute()
    payload = msg.get("payload", {})
    return {"ok": True, "id": message_id, "from": _header(payload, "From"),
            "subject": _header(payload, "Subject"), "date": _header(payload, "Date"),
            "body": _extract_body(payload)[:6000], "snippet": msg.get("snippet", "")}


def _raw_message(to: str, subject: str, body: str) -> str:
    import base64 as _b64
    from email.mime.text import MIMEText
    msg = MIMEText(body, _charset="utf-8")
    msg["to"] = to
    msg["subject"] = subject
    return _b64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")


async def create_draft(to: str, subject: str, body: str) -> dict:
    svc = await _service()
    if not svc:
        return {"ok": False, "connected": False, "error": "Gmail non connecté."}
    draft = svc.users().drafts().create(
        userId="me", body={"message": {"raw": _raw_message(to, subject, body)}}).execute()
    return {"ok": True, "draft_id": draft.get("id"), "to": to, "subject": subject}


async def send_message(to: str, subject: str, body: str) -> dict:
    svc = await _service()
    if not svc:
        return {"ok": False, "connected": False, "error": "Gmail non connecté."}
    sent = svc.users().messages().send(
        userId="me", body={"raw": _raw_message(to, subject, body)}).execute()
    return {"ok": True, "message_id": sent.get("id"), "to": to, "subject": subject}
