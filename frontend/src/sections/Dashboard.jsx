import React, { useEffect, useState, useCallback } from "react";
import { Panel, CircularGauge, MiniBar, Sparkline } from "@/components/Hud";
import { api, gmailLoginUrl } from "@/lib/api";
import {
  Cpu, HardDrive, Activity, Mail, MessageCircle, Terminal, ShieldAlert,
  StickyNote, Trash2, Plus, Play, Zap, Brain, Clock, RefreshCw, Wifi,
} from "lucide-react";

function usePoll(fn, deps, interval) {
  const [data, setData] = useState(null);
  const run = useCallback(() => { fn().then(setData).catch(() => {}); }, deps); // eslint-disable-line
  useEffect(() => {
    run();
    if (interval) { const id = setInterval(run, interval); return () => clearInterval(id); }
  }, [run, interval]);
  return [data, run];
}

/* ---------------- LEFT COLUMN ---------------- */
export function DashboardLeft({ assistant }) {
  const [sys] = usePoll(api.systemStats, [], 3000);
  const [ai] = usePoll(api.aiStats, [], 8000);
  const [recent] = usePoll(api.recentCommands, [], 6000);
  const [netHist, setNetHist] = useState([]);

  useEffect(() => {
    if (sys?.net) setNetHist((h) => [...h.slice(-40), sys.net.recv_mb % 100]);
  }, [sys]);

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Statistiques Système" testid="panel-system-stats">
        <div className="flex justify-around">
          <CircularGauge label="CPU" value={sys?.cpu?.percent || 0} color="cyan"
            sub={sys?.cpu?.freq_ghz ? `${sys.cpu.freq_ghz} GHz` : "CPU"} />
          <CircularGauge label="RAM" value={sys?.ram?.percent || 0} color="red"
            sub={sys ? `${sys.ram.used_gb} / ${sys.ram.total_gb} GB` : "RAM"} />
          <CircularGauge label="GPU" value={sys?.gpu?.percent || 0} color="cyan"
            sub={sys?.gpu?.name ? sys.gpu.name.slice(0, 12) : "N/A"} />
        </div>
        <div className="flex justify-center mt-3">
          <CircularGauge label="DISQUE" value={sys?.disk?.percent || 0} color="green" size={78}
            sub={sys ? `${sys.disk.used_gb} / ${sys.disk.total_gb} GB` : "Disque"} />
        </div>
      </Panel>

      <Panel title={<><Brain size={13} /> Statistiques IA</>} testid="panel-ai-stats">
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[["Messages", ai?.messages ?? 0], ["Actions", ai?.tool_calls ?? 0], ["Erreurs", ai?.errors ?? 0]].map(([l, v], i) => (
            <div key={i} className="text-center">
              <div className="font-display glow-text" style={{ fontSize: 24, color: i === 2 ? "var(--red-soft)" : "var(--cyan-bright)" }}>{v}</div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: 1 }}>{l.toUpperCase()}</div>
            </div>
          ))}
        </div>
        {(ai?.breakdown || []).map((b) => (
          <MiniBar key={b.tool} label={b.tool} value={Math.min(100, b.count * 12)} right={`${b.count}×`} />
        ))}
        {!ai?.breakdown?.length && <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Aucune action encore. Parle à JARVIS pour commencer.</div>}
      </Panel>

      <Panel title={<><Wifi size={13} /> Réseau</>} testid="panel-network"
        right={sys && <span className="font-mono" style={{ fontSize: 11, color: "var(--cyan-bright)" }}>↑{sys.net.sent_mb} ↓{sys.net.recv_mb} MB</span>}>
        <Sparkline data={netHist.length ? netHist : [10, 20, 15, 30, 25, 40, 20]} />
      </Panel>

      <Panel title={<><Clock size={13} /> Dernières Commandes</>} testid="panel-recent-commands">
        <div className="flex flex-col gap-1">
          {(recent?.commands || []).slice(0, 6).map((c, i) => (
            <button key={i} className="list-row text-left w-full" style={{ cursor: "pointer" }}
              data-testid={`recent-cmd-${i}`} onClick={() => assistant.send(c.text)}>
              <Play size={13} style={{ color: "var(--cyan-bright)" }} />
              <span className="flex-1 truncate" style={{ fontSize: 13 }}>{c.text}</span>
            </button>
          ))}
          {!recent?.commands?.length && <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Aucune commande récente.</div>}
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- RIGHT COLUMN ---------------- */
export function DashboardRight({ assistant }) {
  const [gmail, refreshGmail] = usePoll(api.gmailRecent, [], 0);
  const [gstatus] = usePoll(api.gmailStatus, [], 0);
  const [wa] = usePoll(api.whatsapp, [], 0);
  const [cyber] = usePoll(api.cyberTools, [], 0);
  const [target, setTarget] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <Panel title={<><Mail size={13} /> Mes Emails Récents</>} testid="panel-emails"
        right={<button className="text-xs" onClick={refreshGmail} style={{ color: "var(--text-dim)" }}><RefreshCw size={13} /></button>}>
        {gmail?.connected ? (
          <div className="flex flex-col gap-1">
            {(gmail.emails || []).slice(0, 5).map((e) => (
              <div key={e.id} className="list-row" data-testid="email-row">
                <span className={`dot ${e.unread ? "on" : ""}`} style={{ background: e.unread ? undefined : "var(--text-dim)" }} />
                <div className="flex-1 min-w-0">
                  <div className="truncate" style={{ fontSize: 13, color: "var(--text)" }}>{e.subject}</div>
                  <div className="truncate" style={{ fontSize: 11, color: "var(--text-dim)" }}>{e.from}</div>
                </div>
              </div>
            ))}
            {!gmail.emails?.length && <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Boîte vide.</div>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
              {gstatus?.configured === false ? "Identifiants Google non configurés (voir Paramètres)." : "Gmail non connecté."}
            </div>
            {gstatus?.configured && (
              <a className="btn text-center" href={gmailLoginUrl} data-testid="connect-gmail-btn">Connecter Gmail</a>
            )}
          </div>
        )}
      </Panel>

      <Panel title={<><MessageCircle size={13} /> WhatsApp</>} testid="panel-whatsapp"
        right={<span className="chip" style={{ background: "rgba(57,230,160,.12)", color: "var(--green)" }}>{wa?.unread || 0} non lus</span>}>
        <div className="flex flex-col gap-1">
          {(wa?.messages || []).slice(0, 4).map((m, i) => (
            <div key={i} className="list-row" data-testid="wa-row">
              <span className={`dot ${m.unread ? "on" : ""}`} style={{ background: m.unread ? undefined : "var(--text-dim)" }} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between">
                  <span style={{ fontSize: 13, color: "var(--text)" }}>{m.from}</span>
                  <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{m.time}</span>
                </div>
                <div className="truncate" style={{ fontSize: 12, color: "var(--text-dim)" }}>{m.text}</div>
              </div>
            </div>
          ))}
        </div>
        {wa?.mocked && <div style={{ fontSize: 10, color: "var(--amber)", marginTop: 6 }}>Données de démonstration (pas d'API WhatsApp personnelle officielle).</div>}
      </Panel>

      <Panel title={<><ShieldAlert size={13} /> Cybersécurité — Scan 1-Clic</>} red testid="panel-cyber">
        <input className="field mb-2" placeholder="domaine ou IP (ex: scanme.nmap.org)"
          value={target} onChange={(e) => setTarget(e.target.value)} data-testid="cyber-target-input" />
        <div className="grid grid-cols-2 gap-2 mb-2">
          {[["Nmap", "nmap"], ["Ports+Vers.", "nmap_full"], ["Vulnérabilités", "nmap_vuln"], ["Dirb", "dirb"]].map(([label, p]) => (
            <button key={p} className="btn red text-xs" data-testid={`cyber-scan-${p}`}
              disabled={!target}
              onClick={() => assistant.send(`Prépare un scan ${p} sur ${target}. Je suis autorisé à tester cette cible (laboratoire).`)}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {(cyber?.tools || []).slice(0, 4).map((t) => (
            <div key={t.id} className="flex justify-between" style={{ fontSize: 12 }}>
              <span style={{ color: "var(--text-dim)" }}>{t.binary}</span>
              <span style={{ color: t.installed ? "var(--green)" : "var(--red-soft)" }}>{t.installed ? "installé" : "absent"}</span>
            </div>
          ))}
        </div>
      </Panel>

      <NotesPanel />
    </div>
  );
}

function NotesPanel() {
  const [notes, setNotes] = useState([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const load = useCallback(() => api.notes().then((d) => setNotes(d.notes || [])).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!content.trim()) return;
    await api.addNote({ title: title || "Note", content, lang: "text" });
    setTitle(""); setContent(""); setOpen(false); load();
  };
  const del = async (id) => { await api.delNote(id); load(); };

  return (
    <Panel title={<><StickyNote size={13} /> Code & Pense-bête</>} testid="panel-notes"
      right={<button onClick={() => setOpen((o) => !o)} style={{ color: "var(--cyan-bright)" }} data-testid="note-toggle-btn"><Plus size={16} /></button>}>
      {open && (
        <div className="flex flex-col gap-2 mb-3">
          <input className="field" placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="note-title-input" />
          <textarea className="field font-mono" rows={4} placeholder="Colle ton code ou ta note ici..." value={content} onChange={(e) => setContent(e.target.value)} data-testid="note-content-input" />
          <button className="btn" onClick={add} data-testid="note-save-btn">Enregistrer</button>
        </div>
      )}
      <div className="flex flex-col gap-2" style={{ maxHeight: 220, overflowY: "auto" }}>
        {notes.map((n) => (
          <div key={n.id} className="panel" style={{ padding: "8px 10px" }} data-testid="note-item">
            <div className="flex justify-between items-center">
              <span className="font-display" style={{ fontSize: 12, color: "var(--cyan-bright)" }}>{n.title}</span>
              <button onClick={() => del(n.id)} style={{ color: "var(--red-soft)" }} data-testid="note-delete-btn"><Trash2 size={13} /></button>
            </div>
            <pre className="font-mono" style={{ fontSize: 11, color: "var(--text-dim)", whiteSpace: "pre-wrap", margin: "4px 0 0" }}>{n.content}</pre>
          </div>
        ))}
        {!notes.length && !open && <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Aucune note. Ajoute un bout de code à retenir.</div>}
      </div>
    </Panel>
  );
}
