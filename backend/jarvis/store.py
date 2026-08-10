"""Central data store: MongoDB client, config, logs, memory."""
import os
from pathlib import Path
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = ROOT_DIR.parent

# Working directories (configurable, default under project root)
WORKSPACE_DIR = Path(os.environ.get("JARVIS_WORKSPACE", PROJECT_ROOT / "workspace"))
LOGS_DIR = Path(os.environ.get("JARVIS_LOGS", PROJECT_ROOT / "logs"))
REPORTS_DIR = Path(os.environ.get("JARVIS_REPORTS", PROJECT_ROOT / "reports"))
for _d in (WORKSPACE_DIR, LOGS_DIR, REPORTS_DIR):
    _d.mkdir(parents=True, exist_ok=True)

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = _client[os.environ["DB_NAME"]]

DEFAULT_CONFIG = {
    "_id": "main",
    "anthropic_api_key": "",
    "anthropic_model": "claude-sonnet-4-5-20250929",
    "wake_word": "jarvis",
    "voice": {"name": "", "rate": 1.0, "pitch": 1.0, "volume": 1.0, "lang": "fr-FR"},
    "permissions": {
        "read": True,
        "normal": True,
        "sensitive": True,
        "cybersecurity": True,
        "terminal": True,
    },
    "allowed_folders": [],
    "allowed_apps": [],
    "cyber_authorized_targets": [],
    "gmail_connected": False,
}


async def get_config() -> dict:
    doc = await db.config.find_one({"_id": "main"})
    if not doc:
        await db.config.insert_one(dict(DEFAULT_CONFIG))
        return dict(DEFAULT_CONFIG)
    merged = {**DEFAULT_CONFIG, **doc}
    return merged


async def update_config(patch: dict) -> dict:
    await db.config.update_one({"_id": "main"}, {"$set": patch}, upsert=True)
    return await get_config()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def log_action(*, user_command: str = "", tool: str = "", result: str = "",
                     error: str = "", level: str = "info", category: str = "") -> dict:
    entry = {
        "timestamp": now_iso(),
        "user_command": user_command,
        "tool": tool,
        "category": category,
        "result": (result or "")[:2000],
        "error": (error or "")[:2000],
        "level": level,
    }
    await db.logs.insert_one(dict(entry))
    try:
        line = f"{entry['timestamp']} [{level.upper()}] tool={tool} cmd={user_command!r} err={error!r}\n"
        with open(LOGS_DIR / "actions.log", "a", encoding="utf-8") as f:
            f.write(line)
    except Exception:
        pass
    entry.pop("_id", None)
    return entry
