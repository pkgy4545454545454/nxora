import React, { useState, useEffect } from "react";
import { Panel, MiniBar } from "@/components/Hud";
import { api } from "@/lib/api";
import { AppWindow, FolderSearch, Globe, ShieldAlert, HardDrive, Usb, ScrollText, Play } from "lucide-react";

export function ApplicationsView({ assistant }) {
  const [apps, setApps] = useState(null);
  useEffect(() => { api.applications().then(setApps).catch(() => {}); }, []);
  return (
    <Panel title={<><AppWindow size={13} /> Applications Détectées</>} testid="view-applications">
      <div className="grid grid-cols-2 gap-2">
        {(apps?.applications || []).map((a) => (
          <button key={a.command} className="btn text-left" data-testid={`launch-${a.command}`}
            onClick={() => assistant.send(`Lance ${a.name}`)}>
            <Play size={12} className="inline mr-1" /> {a.name}
          </button>
        ))}
      </div>
      {!apps?.applications?.length && <div style={{ color: "var(--text-dim)" }}>Aucune application détectée dans cet environnement.</div>}
    </Panel>
  );
}

export function FilesView({ assistant }) {
  const [q, setQ] = useState("");
  const quick = [["Ouvrir Documents", "Ouvre le dossier Documents"], ["Ouvrir Images", "Ouvre le dossier Images"],
    ["Ouvrir Téléchargements", "Ouvre le dossier Downloads"], ["Ouvrir Bureau", "Ouvre le Bureau"]];
  return (
    <Panel title={<><FolderSearch size={13} /> Gestion des Fichiers</>} testid="view-files">
      <div className="flex gap-2 mb-3">
        <input className="field" placeholder="Rechercher un fichier (ex: facture.pdf)" value={q} onChange={(e) => setQ(e.target.value)} data-testid="file-search-input" />
        <button className="btn" onClick={() => q && assistant.send(`Cherche le fichier ${q}`)} data-testid="file-search-btn">Chercher</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {quick.map(([l, c]) => <button key={l} className="btn" onClick={() => assistant.send(c)}>{l}</button>)}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 10 }}>
        Dis à JARVIS : « renomme image.png en logo.png », « supprime vieux.txt » (confirmation demandée), « déplace X vers Documents »…
      </div>
    </Panel>
  );
}

export function NetworkView({ assistant }) {
  const sites = ["YouTube", "Google", "GitHub", "Gmail", "Instagram", "LinkedIn", "ChatGPT", "Maps"];
  return (
    <Panel title={<><Globe size={13} /> Navigation Internet</>} testid="view-network">
      <div className="grid grid-cols-4 gap-2">
        {sites.map((s) => <button key={s} className="btn" data-testid={`site-${s}`} onClick={() => assistant.send(`Ouvre ${s}`)}>{s}</button>)}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 10 }}>Ou dis : « Va sur Google et cherche les meilleurs restaurants à Genève ».</div>
    </Panel>
  );
}

export function SecurityView({ assistant }) {
  const [cyber, setCyber] = useState(null);
  const [logs, setLogs] = useState(null);
  useEffect(() => {
    api.cyberTools().then(setCyber).catch(() => {});
    api.logs().then(setLogs).catch(() => {});
  }, []);
  return (
    <div className="flex flex-col gap-4" style={{ overflowY: "auto", height: "100%" }}>
      <Panel title={<><ShieldAlert size={13} /> Outils de Cybersécurité</>} red testid="view-security">
        {(cyber?.tools || []).map((t) => (
          <div key={t.id} className="flex justify-between list-row">
            <span>{t.label}</span>
            <span style={{ color: t.installed ? "var(--green)" : "var(--red-soft)", fontSize: 12 }}>{t.installed ? "installé" : "non installé"}</span>
          </div>
        ))}
      </Panel>
      <Panel title={<><ScrollText size={13} /> Journal des Actions</>} testid="view-logs">
        <div style={{ maxHeight: 300, overflowY: "auto" }}>
          {(logs?.logs || []).map((l, i) => (
            <div key={i} className="font-mono" style={{ fontSize: 11, padding: "4px 0", borderBottom: "1px solid rgba(45,130,200,0.1)", color: l.level === "error" ? "var(--red-soft)" : "var(--text-dim)" }}>
              <span style={{ color: "var(--cyan-bright)" }}>[{l.tool || "—"}]</span> {l.user_command} {l.error && `· ${l.error}`}
            </div>
          ))}
          {!logs?.logs?.length && <div style={{ color: "var(--text-dim)" }}>Aucune action journalisée.</div>}
        </div>
      </Panel>
    </div>
  );
}

export function SystemView() {
  const [sys, setSys] = useState(null);
  const [dev, setDev] = useState(null);
  useEffect(() => {
    const f = () => api.systemStats().then(setSys).catch(() => {});
    f(); const id = setInterval(f, 3000);
    api.devices().then(setDev).catch(() => {});
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col gap-4" style={{ overflowY: "auto", height: "100%" }}>
      <Panel title={<><HardDrive size={13} /> Système en Temps Réel</>} testid="view-system">
        <MiniBar label="Processeur (CPU)" value={sys?.cpu?.percent || 0} right={`${sys?.cpu?.percent || 0}%`} />
        <MiniBar label="Mémoire (RAM)" value={sys?.ram?.percent || 0} color="red" right={sys ? `${sys.ram.used_gb}/${sys.ram.total_gb} GB` : ""} />
        <MiniBar label="Disque" value={sys?.disk?.percent || 0} right={sys ? `${sys.disk.used_gb}/${sys.disk.total_gb} GB` : ""} />
        {sys?.temp_c != null && <MiniBar label="Température CPU" value={sys.temp_c} color="red" right={`${sys.temp_c}°C`} />}
      </Panel>
      <Panel title={<><Usb size={13} /> Périphériques Connectés</>} testid="view-devices">
        {(dev?.devices || []).map((d, i) => (
          <div key={i} className="font-mono list-row" style={{ fontSize: 12 }}>{d.usb || `${d.device} → ${d.mount} (${d.fs})`}</div>
        ))}
        {!dev?.devices?.length && <div style={{ color: "var(--text-dim)" }}>Aucun périphérique amovible détecté.</div>}
      </Panel>
    </div>
  );
}
