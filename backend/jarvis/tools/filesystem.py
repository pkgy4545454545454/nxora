"""Filesystem tools: search, list, open, read, rename, move, copy, delete."""
import os
import sys
import shutil
import subprocess
from pathlib import Path

COMMON_FOLDERS = {
    "documents": "Documents", "docs": "Documents",
    "images": "Pictures", "pictures": "Pictures", "photos": "Pictures",
    "downloads": "Downloads", "téléchargements": "Downloads",
    "desktop": "Desktop", "bureau": "Desktop",
    "videos": "Videos", "vidéos": "Videos", "video": "Videos",
    "music": "Music", "musique": "Music",
}


def resolve_base(path: str | None) -> Path:
    if not path:
        return Path.home()
    key = path.strip().lower()
    if key in COMMON_FOLDERS:
        return Path.home() / COMMON_FOLDERS[key]
    p = Path(path).expanduser()
    if not p.is_absolute():
        p = Path.home() / path
    return p


def _open_native(target: str) -> None:
    if sys.platform.startswith("win"):
        os.startfile(target)  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", target])
    else:
        subprocess.Popen(["xdg-open", target])


def fs_search(name: str, base: str | None = None, limit: int = 50):
    root = resolve_base(base)
    if not root.exists():
        return {"ok": False, "error": f"Dossier introuvable: {root}"}
    matches = []
    needle = name.lower()
    for dirpath, _dirs, files in os.walk(root):
        for f in files:
            if needle in f.lower():
                matches.append(str(Path(dirpath) / f))
                if len(matches) >= limit:
                    return {"ok": True, "matches": matches, "truncated": True}
    return {"ok": True, "matches": matches, "count": len(matches)}


def fs_list(path: str | None = None):
    root = resolve_base(path)
    if not root.exists():
        return {"ok": False, "error": f"Chemin introuvable: {root}"}
    items = []
    for p in sorted(root.iterdir()):
        items.append({"name": p.name, "path": str(p), "type": "dir" if p.is_dir() else "file"})
    return {"ok": True, "path": str(root), "items": items[:200]}


def fs_open(path: str):
    target = resolve_base(path)
    if not target.exists():
        return {"ok": False, "error": f"Introuvable: {target}"}
    try:
        _open_native(str(target))
        return {"ok": True, "opened": str(target)}
    except Exception as e:
        return {"ok": False, "error": str(e), "path": str(target)}


def fs_read(path: str, max_chars: int = 8000):
    p = resolve_base(path)
    if not p.exists() or p.is_dir():
        return {"ok": False, "error": f"Fichier introuvable: {p}"}
    try:
        content = p.read_text(encoding="utf-8", errors="replace")[:max_chars]
        return {"ok": True, "path": str(p), "content": content}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def fs_rename(path: str, new_name: str):
    p = resolve_base(path)
    if not p.exists():
        return {"ok": False, "error": f"Introuvable: {p}"}
    target = p.parent / new_name
    p.rename(target)
    return {"ok": True, "from": str(p), "to": str(target)}


def fs_move(path: str, destination: str):
    p = resolve_base(path)
    dest = resolve_base(destination)
    if not p.exists():
        return {"ok": False, "error": f"Introuvable: {p}"}
    shutil.move(str(p), str(dest))
    return {"ok": True, "from": str(p), "to": str(dest)}


def fs_copy(path: str, destination: str):
    p = resolve_base(path)
    dest = resolve_base(destination)
    if not p.exists():
        return {"ok": False, "error": f"Introuvable: {p}"}
    if p.is_dir():
        shutil.copytree(str(p), str(Path(dest) / p.name))
    else:
        shutil.copy2(str(p), str(dest))
    return {"ok": True, "from": str(p), "to": str(dest)}


def fs_delete(path: str, confirm: bool = False):
    if not confirm:
        return {"ok": False, "needs_confirmation": True,
                "message": f"Confirmation requise pour supprimer {path}."}
    p = resolve_base(path)
    if not p.exists():
        return {"ok": False, "error": f"Introuvable: {p}"}
    if p.is_dir():
        shutil.rmtree(str(p))
    else:
        p.unlink()
    return {"ok": True, "deleted": str(p)}


REGISTRY = [
    {"name": "fs_search", "category": "read", "func": fs_search,
     "description": "Rechercher des fichiers par nom (sous-chaîne) dans un dossier. base peut être 'Documents','Images','Downloads','Desktop' ou un chemin.",
     "input_schema": {"type": "object", "properties": {
         "name": {"type": "string", "description": "Nom ou partie du nom du fichier"},
         "base": {"type": "string", "description": "Dossier de départ (optionnel)"}},
         "required": ["name"]}},
    {"name": "fs_list", "category": "read", "func": fs_list,
     "description": "Lister le contenu d'un dossier.",
     "input_schema": {"type": "object", "properties": {
         "path": {"type": "string", "description": "Dossier à lister"}}, "required": []}},
    {"name": "fs_open", "category": "normal", "func": fs_open,
     "description": "Ouvrir un fichier ou un dossier avec l'application par défaut du système.",
     "input_schema": {"type": "object", "properties": {
         "path": {"type": "string", "description": "Fichier/dossier à ouvrir (nom courant ou chemin)"}},
         "required": ["path"]}},
    {"name": "fs_read", "category": "read", "func": fs_read,
     "description": "Lire le contenu texte d'un fichier.",
     "input_schema": {"type": "object", "properties": {
         "path": {"type": "string"}}, "required": ["path"]}},
    {"name": "fs_rename", "category": "normal", "func": fs_rename,
     "description": "Renommer un fichier ou dossier.",
     "input_schema": {"type": "object", "properties": {
         "path": {"type": "string"}, "new_name": {"type": "string"}}, "required": ["path", "new_name"]}},
    {"name": "fs_move", "category": "normal", "func": fs_move,
     "description": "Déplacer un fichier ou dossier vers une destination.",
     "input_schema": {"type": "object", "properties": {
         "path": {"type": "string"}, "destination": {"type": "string"}}, "required": ["path", "destination"]}},
    {"name": "fs_copy", "category": "normal", "func": fs_copy,
     "description": "Copier un fichier ou dossier vers une destination.",
     "input_schema": {"type": "object", "properties": {
         "path": {"type": "string"}, "destination": {"type": "string"}}, "required": ["path", "destination"]}},
    {"name": "fs_delete", "category": "sensitive", "func": fs_delete,
     "description": "Supprimer définitivement un fichier ou dossier. Nécessite confirm=true après confirmation vocale de l'utilisateur.",
     "input_schema": {"type": "object", "properties": {
         "path": {"type": "string"},
         "confirm": {"type": "boolean", "description": "true uniquement après confirmation explicite de l'utilisateur"}},
         "required": ["path"]}},
]
