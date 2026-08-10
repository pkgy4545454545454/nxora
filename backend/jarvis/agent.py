"""JARVIS agent: Claude tool-use loop over the tool registry."""
import os
import json
import asyncio
import anthropic

from jarvis.store import db, get_config, log_action, now_iso
from jarvis.prompts import SYSTEM_PROMPT
from jarvis.tools import anthropic_schemas, get_tool

MAX_ITERS = 8
HISTORY_TURNS = 20


def _enabled_categories(config: dict) -> set[str]:
    perms = config.get("permissions", {})
    cats = {"read"}
    if perms.get("normal", True):
        cats.add("normal")
    if perms.get("sensitive", True):
        cats.add("sensitive")
    if perms.get("terminal", True):
        cats.add("terminal")
    if perms.get("cybersecurity", True):
        cats.add("cybersecurity")
    return cats


async def _load_history(session_id: str) -> list[dict]:
    docs = await db.conversations.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("seq", 1).to_list(HISTORY_TURNS * 2)
    return [{"role": d["role"], "content": d["text"]} for d in docs[-HISTORY_TURNS * 2:]]


async def _save_message(session_id: str, role: str, text: str):
    seq = await db.conversations.count_documents({"session_id": session_id})
    await db.conversations.insert_one({
        "session_id": session_id, "seq": seq, "role": role,
        "text": text, "timestamp": now_iso(),
    })


async def _execute_tool(name: str, args: dict, enabled: set[str], user_message: str) -> dict:
    meta = get_tool(name)
    if not meta:
        return {"ok": False, "error": f"Outil inconnu: {name}"}
    if meta["category"] not in enabled and meta["category"] != "read":
        await log_action(user_command=user_message, tool=name, category=meta["category"],
                         error="permission refusée", level="warning")
        return {"ok": False, "error": f"Permission refusée pour la catégorie '{meta['category']}'. "
                                      "Active-la dans les Paramètres."}
    try:
        result = await asyncio.to_thread(meta["func"], **args)
    except TypeError as e:
        result = {"ok": False, "error": f"Arguments invalides: {e}"}
    except Exception as e:
        result = {"ok": False, "error": str(e)}
    await log_action(user_command=user_message, tool=name, category=meta["category"],
                     result=json.dumps(result, ensure_ascii=False)[:1500],
                     error=result.get("error", "") if isinstance(result, dict) else "",
                     level="error" if isinstance(result, dict) and not result.get("ok") else "info")
    return result


async def run_agent(session_id: str, user_message: str) -> dict:
    config = await get_config()
    api_key = os.environ.get("ANTHROPIC_API_KEY") or config.get("anthropic_api_key", "")
    if not api_key:
        return {"ok": False, "reply": "Ma clé API Claude n'est pas configurée. Ajoute-la dans les Paramètres.",
                "tools_used": [], "needs_key": True}

    model = config.get("anthropic_model") or "claude-sonnet-4-5-20250929"
    enabled = _enabled_categories(config)
    tools = anthropic_schemas(enabled)
    client = anthropic.AsyncAnthropic(api_key=api_key)

    history = await _load_history(session_id)
    messages = history + [{"role": "user", "content": user_message}]

    tools_used: list[str] = []
    actions: list[dict] = []
    open_urls: list[str] = []

    try:
        for _ in range(MAX_ITERS):
            resp = await client.messages.create(
                model=model, max_tokens=4096, system=SYSTEM_PROMPT,
                tools=tools, messages=messages,
            )
            if resp.stop_reason != "tool_use":
                text = "".join(b.text for b in resp.content if b.type == "text").strip()
                await _save_message(session_id, "user", user_message)
                await _save_message(session_id, "assistant", text)
                return {"ok": True, "reply": text, "tools_used": tools_used,
                        "actions": actions, "open_urls": open_urls}

            messages.append({"role": "assistant", "content": resp.content})
            tool_results = []
            for block in resp.content:
                if block.type != "tool_use":
                    continue
                tools_used.append(block.name)
                result = await _execute_tool(block.name, dict(block.input), enabled, user_message)
                if isinstance(result, dict) and result.get("open_in_browser"):
                    open_urls.append(result["open_in_browser"])
                actions.append({"tool": block.name, "input": block.input,
                                "ok": bool(result.get("ok")) if isinstance(result, dict) else True})
                tool_results.append({"type": "tool_result", "tool_use_id": block.id,
                                     "content": json.dumps(result, ensure_ascii=False)})
            messages.append({"role": "user", "content": tool_results})

        return {"ok": True, "reply": "J'ai atteint la limite d'étapes pour cette action.",
                "tools_used": tools_used, "actions": actions, "open_urls": open_urls}
    except anthropic.AuthenticationError:
        return {"ok": False, "reply": "Clé API Claude invalide. Vérifie-la dans les Paramètres.",
                "tools_used": tools_used, "needs_key": True}
    except Exception as e:
        msg = str(e)
        if "credit balance" in msg.lower() or "billing" in msg.lower():
            reply = ("Ma clé Claude fonctionne, mais le solde de crédits de ton compte Anthropic est "
                     "insuffisant. Ajoute des crédits sur console.anthropic.com (Plans & Billing) et je serai opérationnel.")
            await log_action(user_command=user_message, tool="agent", error=msg, level="error")
            return {"ok": False, "reply": reply, "tools_used": tools_used, "billing": True}
        await log_action(user_command=user_message, tool="agent", error=msg, level="error")
        return {"ok": False, "reply": f"Une erreur est survenue: {e}", "tools_used": tools_used}
