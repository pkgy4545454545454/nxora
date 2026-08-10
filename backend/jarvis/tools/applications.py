"""Application launcher: detect and launch installed programs."""
import os
import sys
import shutil
import subprocess

# name aliases -> possible executables / commands per platform
APP_MAP = {
    "visual studio code": ["code", "code.cmd"], "vscode": ["code", "code.cmd"], "vs code": ["code", "code.cmd"],
    "chrome": ["google-chrome", "chrome", "google-chrome-stable"], "google chrome": ["google-chrome", "chrome"],
    "firefox": ["firefox"],
    "terminal": ["gnome-terminal", "x-terminal-emulator", "xterm", "cmd"],
    "powershell": ["pwsh", "powershell"],
    "ubuntu": ["ubuntu", "wsl"], "wsl": ["wsl"],
    "docker": ["docker"],
    "python": ["python3", "python"],
    "git": ["git"],
    "notepad": ["notepad", "gedit"],
    "explorer": ["explorer", "nautilus"], "explorateur": ["explorer", "nautilus"],
    "spotify": ["spotify"],
    "discord": ["discord"],
}

WINDOWS_APP_MAP = {
    "visual studio code": r"code", "chrome": r"chrome", "google chrome": r"chrome",
    "firefox": r"firefox", "terminal": "wt", "powershell": "powershell",
    "ubuntu": "ubuntu", "wsl": "wsl", "docker": "docker desktop", "notepad": "notepad",
    "explorer": "explorer", "spotify": "spotify", "discord": "discord",
}


def detect_applications():
    found = []
    seen = set()
    for label, cands in APP_MAP.items():
        for c in cands:
            path = shutil.which(c)
            if path and c not in seen:
                found.append({"name": label, "command": c, "path": path})
                seen.add(c)
                break
    return {"ok": True, "applications": found, "count": len(found)}


def launch_application(name: str):
    key = name.strip().lower()
    if sys.platform.startswith("win"):
        exe = WINDOWS_APP_MAP.get(key, name)
        try:
            subprocess.Popen(["cmd", "/c", "start", "", exe], shell=False)
            return {"ok": True, "launched": exe}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    cands = APP_MAP.get(key, [key])
    for c in cands:
        path = shutil.which(c)
        if path:
            try:
                subprocess.Popen([path], start_new_session=True)
                return {"ok": True, "launched": c, "path": path}
            except Exception as e:
                return {"ok": False, "error": str(e)}
    return {"ok": False, "error": f"Application '{name}' introuvable sur ce système."}


def close_application(name: str, confirm: bool = False):
    if not confirm:
        return {"ok": False, "needs_confirmation": True,
                "message": f"Confirmer la fermeture de {name} ?"}
    key = name.strip().lower()
    try:
        if sys.platform.startswith("win"):
            exe = WINDOWS_APP_MAP.get(key, name)
            subprocess.run(["taskkill", "/IM", f"{exe}.exe", "/F"], capture_output=True)
        else:
            proc = (APP_MAP.get(key, [key])[0])
            subprocess.run(["pkill", "-f", proc], capture_output=True)
        return {"ok": True, "closed": name}
    except Exception as e:
        return {"ok": False, "error": str(e)}


REGISTRY = [
    {"name": "detect_applications", "category": "read", "func": detect_applications,
     "description": "Détecter les applications installées disponibles.",
     "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"name": "launch_application", "category": "normal", "func": launch_application,
     "description": "Lancer une application installée (ex: 'Visual Studio Code', 'Chrome', 'Ubuntu', 'Terminal').",
     "input_schema": {"type": "object", "properties": {
         "name": {"type": "string"}}, "required": ["name"]}},
    {"name": "close_application", "category": "sensitive", "func": close_application,
     "description": "Fermer une application. confirm=true après confirmation utilisateur.",
     "input_schema": {"type": "object", "properties": {
         "name": {"type": "string"}, "confirm": {"type": "boolean"}}, "required": ["name"]}},
]
