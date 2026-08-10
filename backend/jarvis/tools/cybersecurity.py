"""Cybersecurity tools for authorized/lab targets only."""
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from jarvis.store import REPORTS_DIR

SCAN_PROFILES = {
    "nmap": {"cmd": "nmap -F {target}", "label": "Scan de ports rapide (Nmap)"},
    "nmap_full": {"cmd": "nmap -sV -p- {target}", "label": "Scan complet + versions (Nmap)"},
    "nmap_vuln": {"cmd": "nmap --script vuln {target}", "label": "Scan de vulnérabilités (Nmap)"},
    "dirb": {"cmd": "dirb http://{target}", "label": "Énumération de répertoires (dirb)"},
    "sqlmap": {"cmd": "sqlmap -u http://{target} --batch", "label": "Test injection SQL (sqlmap)"},
    "whatweb": {"cmd": "whatweb {target}", "label": "Empreinte technologique (whatweb)"},
}


def list_security_tools():
    tools = []
    for key, prof in SCAN_PROFILES.items():
        binary = prof["cmd"].split()[0]
        tools.append({"id": key, "label": prof["label"], "binary": binary,
                      "installed": shutil.which(binary) is not None})
    return {"ok": True, "tools": tools}


def run_security_scan(target: str, profile: str = "nmap", authorized: bool = False,
                      confirm: bool = False, timeout: int = 180):
    if not authorized or not confirm:
        return {"ok": False, "needs_confirmation": True,
                "message": f"Confirme que tu es AUTORISÉ à scanner {target} (laboratoire / système que tu possèdes). "
                           "Appelle avec authorized=true et confirm=true après confirmation explicite."}
    prof = SCAN_PROFILES.get(profile, SCAN_PROFILES["nmap"])
    binary = prof["cmd"].split()[0]
    if not shutil.which(binary):
        return {"ok": False, "error": f"Outil '{binary}' non installé sur ce système."}
    cmd = prof["cmd"].format(target=target)
    try:
        proc = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        output = (proc.stdout or "") + (("\n" + proc.stderr) if proc.stderr else "")
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        report = REPORTS_DIR / f"scan-{profile}-{stamp}.txt"
        report.write_text(f"Cible: {target}\nProfil: {profile}\nCommande: {cmd}\n\n{output}", encoding="utf-8")
        return {"ok": True, "target": target, "profile": profile, "command": cmd,
                "output": output[:6000], "report_file": str(report)}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"Scan interrompu (timeout {timeout}s)"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def save_report(content: str, filename: str = "rapport.txt", fmt: str = "txt"):
    fp = REPORTS_DIR / filename
    if fmt == "json":
        fp.write_text(json.dumps({"content": content}, ensure_ascii=False, indent=2), encoding="utf-8")
    elif fmt == "html":
        fp.write_text(f"<html><body><pre>{content}</pre></body></html>", encoding="utf-8")
    else:
        fp.write_text(content, encoding="utf-8")
    return {"ok": True, "report_file": str(fp)}


REGISTRY = [
    {"name": "list_security_tools", "category": "read", "func": list_security_tools,
     "description": "Lister les outils de cybersécurité disponibles et leur profil.",
     "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"name": "run_security_scan", "category": "cybersecurity", "func": run_security_scan,
     "description": "Lancer un scan de sécurité sur une cible AUTORISÉE uniquement. profile: nmap|nmap_full|nmap_vuln|dirb|sqlmap|whatweb. Requiert authorized=true et confirm=true.",
     "input_schema": {"type": "object", "properties": {
         "target": {"type": "string"}, "profile": {"type": "string"},
         "authorized": {"type": "boolean"}, "confirm": {"type": "boolean"}},
         "required": ["target"]}},
    {"name": "save_report", "category": "normal", "func": save_report,
     "description": "Sauvegarder un rapport de résultats (txt, json ou html).",
     "input_schema": {"type": "object", "properties": {
         "content": {"type": "string"}, "filename": {"type": "string"}, "fmt": {"type": "string"}},
         "required": ["content"]}},
]
