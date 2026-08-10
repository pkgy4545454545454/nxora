"""System information and connected devices."""
import shutil
import subprocess
import psutil


def get_system_stats():
    cpu = psutil.cpu_percent(interval=0.3)
    freq = psutil.cpu_freq()
    vm = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    net = psutil.net_io_counters()
    gpu = _gpu_stats()
    temp = _cpu_temp()
    return {
        "ok": True,
        "cpu": {"percent": round(cpu, 1), "freq_ghz": round((freq.current or 0) / 1000, 1) if freq else None},
        "ram": {"percent": round(vm.percent, 1), "used_gb": round(vm.used / 1e9, 1), "total_gb": round(vm.total / 1e9, 1)},
        "disk": {"percent": round(disk.percent, 1), "used_gb": round(disk.used / 1e9, 0), "total_gb": round(disk.total / 1e9, 0)},
        "gpu": gpu,
        "net": {"sent_mb": round(net.bytes_sent / 1e6, 1), "recv_mb": round(net.bytes_recv / 1e6, 1)},
        "temp_c": temp,
    }


def _gpu_stats():
    if not shutil.which("nvidia-smi"):
        return {"percent": None, "name": None, "available": False}
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=utilization.gpu,name", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5)
        line = out.stdout.strip().splitlines()[0]
        pct, name = [x.strip() for x in line.split(",")]
        return {"percent": float(pct), "name": name, "available": True}
    except Exception:
        return {"percent": None, "name": None, "available": False}


def _cpu_temp():
    try:
        temps = psutil.sensors_temperatures()
        for _k, entries in temps.items():
            if entries:
                return round(entries[0].current, 1)
    except Exception:
        pass
    return None


def list_usb_devices():
    devices = []
    try:
        for p in psutil.disk_partitions(all=False):
            if "removable" in p.opts or (p.device and ("/media" in p.mountpoint or "/mnt" in p.mountpoint)):
                devices.append({"device": p.device, "mount": p.mountpoint, "fs": p.fstype})
    except Exception:
        pass
    if shutil.which("lsusb"):
        try:
            out = subprocess.run(["lsusb"], capture_output=True, text=True, timeout=5)
            for line in out.stdout.strip().splitlines():
                devices.append({"usb": line})
        except Exception:
            pass
    return {"ok": True, "devices": devices, "count": len(devices)}


REGISTRY = [
    {"name": "get_system_stats", "category": "read", "func": get_system_stats,
     "description": "Obtenir les statistiques système en temps réel (CPU, RAM, disque, GPU, réseau, température).",
     "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"name": "list_usb_devices", "category": "read", "func": list_usb_devices,
     "description": "Lister les périphériques USB / amovibles connectés.",
     "input_schema": {"type": "object", "properties": {}, "required": []}},
]
