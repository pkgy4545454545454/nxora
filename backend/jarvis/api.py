"""JARVIS API router."""
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from jarvis.store import db, get_config, update_config, log_action, now_iso
from jarvis.agent import run_agent
from jarvis.tools import ALL_TOOLS
from jarvis.tools.system_info import get_system_stats, list_usb_devices
from jarvis.tools.cybersecurity import list_security_tools
from jarvis.tools.applications import detect_applications
from jarvis import gmail_service

router = APIRouter(prefix="/api")
FRONTEND_URL = os.environ.get("JARVIS_PUBLIC_URL", "/")


# ---------- models ----------
class ChatIn(BaseModel):
    session_id: str = Field(default="default")
    message: str


class NoteIn(BaseModel):
    title: str = "Note"
    content: str = ""
    lang: str = "text"


class ConfigIn(BaseModel):
    anthropic_api_key: str | None = None
    anthropic_model: str | None = None
    wake_word: str | None = None
    voice: dict | None = None
    permissions: dict | None = None
    allowed_folders: list | None = None
    allowed_apps: list | None = None
    cyber_authorized_targets: list | None = None


# ---------- chat ----------
@router.post("/chat")
async def chat(body: ChatIn):
    return await run_agent(body.session_id, body.message.strip())


@router.get("/history")
async def history(session_id: str = "default", limit: int = 40):
    docs = await db.conversations.find({"session_id": session_id}, {"_id": 0}).sort("seq", 1).to_list(limit)
    return {"messages": docs}


@router.delete("/history")
async def clear_history(session_id: str = "default"):
    await db.conversations.delete_many({"session_id": session_id})
    return {"ok": True}


# ---------- stats ----------
@router.get("/stats/system")
async def stats_system():
    return get_system_stats()


@router.get("/stats/ai")
async def stats_ai():
    total_msgs = await db.conversations.count_documents({"role": "user"})
    total_tools = await db.logs.count_documents({"tool": {"$nin": ["", "agent"]}})
    errors = await db.logs.count_documents({"level": "error"})
    pipeline = [{"$match": {"tool": {"$nin": ["", "agent"]}}},
                {"$group": {"_id": "$tool", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}}, {"$limit": 6}]
    breakdown = [{"tool": d["_id"], "count": d["count"]} async for d in db.logs.aggregate(pipeline)]
    return {"ok": True, "messages": total_msgs, "tool_calls": total_tools,
            "errors": errors, "breakdown": breakdown}


# ---------- commands (1-click / recent) ----------
@router.get("/commands/recent")
async def recent_commands(limit: int = 8):
    docs = await db.conversations.find({"role": "user"}, {"_id": 0, "text": 1, "timestamp": 1}) \
        .sort("seq", -1).to_list(limit)
    return {"commands": docs}


QUICK_COMMANDS = [
    {"label": "Statistiques système", "command": "Donne-moi les statistiques système actuelles"},
    {"label": "Applications disponibles", "command": "Quelles applications sont disponibles ?"},
    {"label": "Ouvrir mes Documents", "command": "Ouvre le dossier Documents"},
    {"label": "Périphériques USB", "command": "Quels périphériques USB sont connectés ?"},
    {"label": "Outils de sécurité", "command": "Liste les outils de cybersécurité disponibles"},
    {"label": "Ouvrir YouTube", "command": "Ouvre YouTube"},
]


@router.get("/commands/quick")
async def quick_commands():
    return {"commands": QUICK_COMMANDS}


# ---------- notes / code snippets ----------
@router.get("/notes")
async def get_notes():
    docs = await db.notes.find({}, {"_id": 0}).sort("created", -1).to_list(100)
    return {"notes": docs}


@router.post("/notes")
async def add_note(body: NoteIn):
    note = {"id": str(uuid.uuid4()), "title": body.title, "content": body.content,
            "lang": body.lang, "created": now_iso()}
    await db.notes.insert_one(dict(note))
    return note


@router.delete("/notes/{note_id}")
async def del_note(note_id: str):
    await db.notes.delete_one({"id": note_id})
    return {"ok": True}


# ---------- logs ----------
@router.get("/logs")
async def get_logs(limit: int = 60):
    docs = await db.logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return {"logs": docs}


# ---------- config ----------
@router.get("/config")
async def read_config():
    cfg = await get_config()
    cfg["anthropic_api_key_set"] = bool(os.environ.get("ANTHROPIC_API_KEY") or cfg.get("anthropic_api_key"))
    cfg.pop("anthropic_api_key", None)
    return cfg


@router.put("/config")
async def write_config(body: ConfigIn):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    cfg = await update_config(patch)
    cfg.pop("anthropic_api_key", None)
    cfg["anthropic_api_key_set"] = bool(os.environ.get("ANTHROPIC_API_KEY") or await _key_set())
    return cfg


async def _key_set():
    c = await db.config.find_one({"_id": "main"})
    return bool((c or {}).get("anthropic_api_key"))


# ---------- devices / apps / security ----------
@router.get("/devices")
async def devices():
    return list_usb_devices()


@router.get("/applications")
async def applications():
    return detect_applications()


@router.get("/cyber/tools")
async def cyber_tools():
    return list_security_tools()


# ---------- gmail ----------
@router.get("/gmail/status")
async def gmail_status():
    return await gmail_service.status()


@router.get("/gmail/recent")
async def gmail_recent():
    try:
        return await gmail_service.recent()
    except Exception as e:
        return {"ok": False, "connected": False, "emails": [], "error": str(e)}


@router.get("/oauth/gmail/login")
async def gmail_login():
    res = await gmail_service.login_url()
    if res.get("ok"):
        return RedirectResponse(res["url"])
    return res


@router.get("/oauth/gmail/callback")
async def gmail_callback(code: str = "", state: str = ""):
    ok = await gmail_service.handle_callback(code, state)
    return RedirectResponse(FRONTEND_URL + ("?gmail=connected" if ok else "?gmail=error"))


# ---------- whatsapp (MOCKED - no official personal read API) ----------
@router.get("/whatsapp/recent")
async def whatsapp_recent():
    return {"ok": True, "mocked": True, "unread": 3, "messages": [
        {"from": "Pierre", "text": "On se voit demain à 14h ?", "time": "10:42", "unread": True},
        {"from": "Maman", "text": "N'oublie pas d'appeler ta sœur", "time": "09:15", "unread": True},
        {"from": "Équipe Projet", "text": "Le build est passé ✅", "time": "08:03", "unread": True},
        {"from": "Léa", "text": "Merci pour hier soir !", "time": "Hier", "unread": False},
    ]}
