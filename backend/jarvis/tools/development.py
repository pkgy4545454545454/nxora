"""Development tools: create projects, write/modify files, run dev servers."""
import subprocess
from pathlib import Path
from jarvis.store import WORKSPACE_DIR

_servers: dict[str, subprocess.Popen] = {}


def _project_dir(name: str) -> Path:
    safe = "".join(c for c in name if c.isalnum() or c in ("-", "_", " ")).strip().replace(" ", "-").lower()
    return WORKSPACE_DIR / (safe or "projet")


def create_project(name: str, files: list | None = None):
    """files: list of {path, content}. Creates a project folder in the workspace."""
    root = _project_dir(name)
    root.mkdir(parents=True, exist_ok=True)
    written = []
    for f in (files or []):
        rel = f.get("path", "").lstrip("/")
        if not rel:
            continue
        fp = root / rel
        fp.parent.mkdir(parents=True, exist_ok=True)
        fp.write_text(f.get("content", ""), encoding="utf-8")
        written.append(str(fp))
    return {"ok": True, "project": str(root), "files": written}


def write_file(project: str, path: str, content: str):
    root = _project_dir(project)
    fp = root / path.lstrip("/")
    fp.parent.mkdir(parents=True, exist_ok=True)
    fp.write_text(content, encoding="utf-8")
    return {"ok": True, "file": str(fp)}


def list_project(project: str):
    root = _project_dir(project)
    if not root.exists():
        return {"ok": False, "error": "Projet introuvable"}
    files = [str(p.relative_to(root)) for p in root.rglob("*") if p.is_file()]
    return {"ok": True, "project": str(root), "files": files[:200]}


def start_dev_server(project: str, command: str = "python3 -m http.server 3055", port: int = 3055):
    root = _project_dir(project)
    if not root.exists():
        return {"ok": False, "error": "Projet introuvable"}
    key = str(root)
    if key in _servers and _servers[key].poll() is None:
        return {"ok": True, "message": "Serveur déjà en cours", "url": f"http://localhost:{port}"}
    try:
        proc = subprocess.Popen(command, shell=True, cwd=str(root))
        _servers[key] = proc
        return {"ok": True, "pid": proc.pid, "url": f"http://localhost:{port}", "project": key}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def stop_dev_server(project: str):
    root = _project_dir(project)
    key = str(root)
    proc = _servers.get(key)
    if proc and proc.poll() is None:
        proc.terminate()
        return {"ok": True, "stopped": key}
    return {"ok": False, "error": "Aucun serveur en cours pour ce projet"}


def open_in_editor(project: str):
    """Open the project folder in VS Code (code <path>)."""
    import shutil
    root = _project_dir(project)
    if not root.exists():
        return {"ok": False, "error": "Projet introuvable"}
    code = shutil.which("code") or shutil.which("code.cmd")
    if not code:
        return {"ok": False, "error": "VS Code (commande 'code') introuvable sur ce système."}
    try:
        subprocess.Popen([code, str(root)])
        return {"ok": True, "opened": str(root)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


REGISTRY = [
    {"name": "create_project", "category": "normal", "func": create_project,
     "description": "Créer un projet complet (site web, app...) dans l'espace de travail en écrivant plusieurs fichiers. Fournir 'files' = liste d'objets {path, content}. Écris toi-même le code (HTML/CSS/JS/React...).",
     "input_schema": {"type": "object", "properties": {
         "name": {"type": "string"},
         "files": {"type": "array", "items": {"type": "object", "properties": {
             "path": {"type": "string"}, "content": {"type": "string"}}}}},
         "required": ["name", "files"]}},
    {"name": "write_file", "category": "normal", "func": write_file,
     "description": "Créer ou modifier un fichier dans un projet existant (pour appliquer des modifications ciblées).",
     "input_schema": {"type": "object", "properties": {
         "project": {"type": "string"}, "path": {"type": "string"}, "content": {"type": "string"}},
         "required": ["project", "path", "content"]}},
    {"name": "list_project", "category": "read", "func": list_project,
     "description": "Lister les fichiers d'un projet du workspace.",
     "input_schema": {"type": "object", "properties": {"project": {"type": "string"}}, "required": ["project"]}},
    {"name": "start_dev_server", "category": "terminal", "func": start_dev_server,
     "description": "Lancer le serveur de développement d'un projet.",
     "input_schema": {"type": "object", "properties": {
         "project": {"type": "string"}, "command": {"type": "string"}, "port": {"type": "integer"}},
         "required": ["project"]}},
    {"name": "stop_dev_server", "category": "normal", "func": stop_dev_server,
     "description": "Arrêter le serveur de développement d'un projet.",
     "input_schema": {"type": "object", "properties": {"project": {"type": "string"}}, "required": ["project"]}},
    {"name": "open_in_editor", "category": "normal", "func": open_in_editor,
     "description": "Ouvrir le dossier d'un projet dans Visual Studio Code.",
     "input_schema": {"type": "object", "properties": {"project": {"type": "string"}}, "required": ["project"]}},
]
