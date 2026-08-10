"""Controlled terminal command execution."""
import subprocess

DANGEROUS = ["rm -rf", "mkfs", "dd if=", ":(){", "shutdown", "reboot", "format ",
             "del /f", "rmdir /s", "> /dev/sda", "chmod -r 777 /"]


def _is_dangerous(cmd: str) -> bool:
    low = cmd.lower()
    return any(d in low for d in DANGEROUS)


def run_command(command: str, cwd: str | None = None, confirm: bool = False, timeout: int = 60):
    if _is_dangerous(command) and not confirm:
        return {"ok": False, "needs_confirmation": True,
                "message": f"Commande potentiellement dangereuse: '{command}'. Confirmer l'exécution ?"}
    try:
        proc = subprocess.run(command, shell=True, cwd=cwd, capture_output=True,
                              text=True, timeout=timeout)
        return {"ok": proc.returncode == 0, "returncode": proc.returncode,
                "stdout": (proc.stdout or "")[:6000], "stderr": (proc.stderr or "")[:4000]}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"Timeout après {timeout}s"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


REGISTRY = [
    {"name": "run_command", "category": "terminal", "func": run_command,
     "description": "Exécuter une commande dans le terminal et récupérer la sortie (stdout/stderr). Pour les commandes dangereuses, confirm=true requis après confirmation utilisateur.",
     "input_schema": {"type": "object", "properties": {
         "command": {"type": "string"},
         "cwd": {"type": "string", "description": "Répertoire d'exécution (optionnel)"},
         "confirm": {"type": "boolean"}}, "required": ["command"]}},
]
