import React, { useState, useEffect, useRef } from "react";
import "@/App.css";
import { api } from "@/lib/api";
import { useAssistant } from "@/hooks/useAssistant";
import Avatar3D from "@/components/Avatar3D";
import { DashboardLeft, DashboardRight } from "@/sections/Dashboard";
import Settings from "@/sections/Settings";
import { ApplicationsView, FilesView, NetworkView, SecurityView, SystemView } from "@/sections/Views";
import {
  LayoutDashboard, AppWindow, Folder, Globe, Shield, Cpu, Settings as Cog,
  Power, Mic, Send, Radio, Square, Activity,
} from "lucide-react";

const NAV = [
  { id: "dashboard", label: "DASHBOARD", icon: LayoutDashboard },
  { id: "applications", label: "APPLICATIONS", icon: AppWindow },
  { id: "files", label: "FICHIERS", icon: Folder },
  { id: "network", label: "RÉSEAUX", icon: Globe },
  { id: "security", label: "SÉCURITÉ", icon: Shield },
  { id: "system", label: "SYSTÈME", icon: Cpu },
  { id: "settings", label: "PARAMÈTRES", icon: Cog },
];

const STATE_LABEL = {
  idle: "EN VEILLE", listening: "À L'ÉCOUTE", thinking: "RÉFLEXION",
  executing: "EXÉCUTION", speaking: "RÉPONSE", error: "ERREUR",
};
const STATE_COLOR = {
  idle: "var(--text-dim)", listening: "var(--cyan-bright)", thinking: "var(--amber)",
  executing: "var(--cyan)", speaking: "var(--green)", error: "var(--red-soft)",
};

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return now;
}

function TopBar({ assistant }) {
  const now = useClock();
  const time = now.toLocaleTimeString("fr-FR", { hour12: false });
  const date = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="flex items-center justify-between px-6 py-3" style={{ borderBottom: "1px solid var(--panel-border)" }}>
      <div className="flex items-center gap-3">
        <span className="font-display" style={{ fontSize: 26, fontWeight: 800, letterSpacing: 3 }}>
          <span style={{ color: "var(--cyan-bright)" }}>JAR</span><span style={{ color: "var(--red-soft)" }}>VIS</span>
        </span>
        <span className="font-display" style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: 3 }}>AI SYSTEM</span>
      </div>
      <div className="text-center">
        <div className="font-display glow-text" style={{ fontSize: 30, color: "var(--cyan-bright)", letterSpacing: 4 }}>{time}</div>
        <div className="font-display" style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: 2, textTransform: "uppercase" }}>{date}</div>
      </div>
      <div className="flex items-center gap-3">
        <Activity size={18} style={{ color: "var(--red-soft)" }} />
        <span className="chip" style={{ background: "rgba(57,230,160,.12)", color: "var(--green)" }}>SYSTEM ONLINE</span>
        <span className="dot on" />
      </div>
    </div>
  );
}

function VoiceConsole({ assistant }) {
  const [text, setText] = useState("");
  const submit = (e) => { e.preventDefault(); if (text.trim()) { assistant.send(text.trim()); setText(""); } };
  const isListening = assistant.listening || assistant.continuous;
  const placeholder = assistant.interim
    || (assistant.continuous
        ? (assistant.armed ? "JARVIS vous écoute… dites votre commande" : "Mode mains-libres : dites « JARVIS »…")
        : "Parlez ou écrivez à JARVIS…");
  return (
    <form className="voice-bar mx-6 mb-4" onSubmit={submit} data-testid="voice-console">
      <div style={{ minWidth: 110 }}>
        <div className="font-display" style={{ fontSize: 11, letterSpacing: 2, color: STATE_COLOR[assistant.state] }}>
          {STATE_LABEL[assistant.state]}
        </div>
        {assistant.continuous && (
          <div className="font-mono" style={{ fontSize: 9, color: assistant.armed ? "var(--green)" : "var(--text-dim)" }}>
            {assistant.armed ? "● MAINS-LIBRES ACTIF" : "○ EN ATTENTE « JARVIS »"}
          </div>
        )}
        {assistant.currentTool && <div className="font-mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>⚙ {assistant.currentTool}</div>}
      </div>
      <input className="flex-1" style={{ background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 16 }}
        placeholder={placeholder} value={text}
        onChange={(e) => setText(e.target.value)} data-testid="voice-input" />
      <div className="wave" style={{ opacity: isListening ? 1 : 0.25 }}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => <span key={i} style={{ animationDelay: `${i * 0.1}s` }} />)}
      </div>
      <button type="submit" className="mic-btn" style={{ borderColor: "var(--cyan)", color: "var(--cyan-bright)" }} data-testid="send-btn">
        <Send size={18} />
      </button>
      <button type="button" className={`mic-btn ${isListening ? "active" : ""}`}
        onClick={assistant.toggleContinuous} data-testid="mic-btn" title="Mode vocal mains-libres (mot d'activation)">
        {isListening ? <Radio size={20} /> : <Mic size={20} />}
      </button>
    </form>
  );
}

function ConversationFeed({ messages }) {
  const ref = useRef();
  useEffect(() => { ref.current && (ref.current.scrollTop = ref.current.scrollHeight); }, [messages]);
  return (
    <div ref={ref} className="flex flex-col gap-2 px-2" style={{ overflowY: "auto", flex: 1, minHeight: 0 }} data-testid="conversation-feed">
      {messages.slice(-8).map((m, i) => (
        <div key={i} className="fade-in" style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%" }}>
          <div style={{
            fontSize: 14, padding: "8px 12px", borderRadius: 10,
            background: m.role === "user" ? "rgba(35,168,255,0.12)" : "rgba(255,59,82,0.08)",
            border: `1px solid ${m.role === "user" ? "rgba(35,168,255,0.3)" : "rgba(255,59,82,0.25)"}`,
            color: "var(--text)",
          }}>{m.text}</div>
        </div>
      ))}
      {!messages.length && (
        <div className="text-center" style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 12 }}>
          « JARVIS, ouvre le dossier Images » · « Lance Visual Studio Code » · « Crée-moi un site pour un restaurant »
        </div>
      )}
    </div>
  );
}

function CenterStage({ assistant }) {
  return (
    <div className="flex flex-col items-center" style={{ height: "100%", minHeight: 0 }}>
      <div style={{ position: "relative", width: "100%", flex: "0 0 46%", minHeight: 300 }}>
        <Avatar3D state={assistant.state} />
        <div className="absolute" style={{ bottom: 6, left: 0, right: 0, textAlign: "center" }}>
          <span className="chip font-display" style={{ background: "rgba(6,12,22,0.7)", color: STATE_COLOR[assistant.state], border: `1px solid ${STATE_COLOR[assistant.state]}`, letterSpacing: 2 }}>
            {STATE_LABEL[assistant.state]}
          </span>
        </div>
      </div>
      <div className="flex flex-col" style={{ flex: 1, width: "100%", minHeight: 0, marginTop: 8 }}>
        <ConversationFeed messages={assistant.messages} />
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [config, setConfig] = useState({ voice: { lang: "fr-FR" }, wake_word: "jarvis" });
  const assistant = useAssistant(config);

  useEffect(() => { api.config().then(setConfig).catch(() => {}); }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail")) { setTab("dashboard"); window.history.replaceState({}, "", window.location.pathname); }
  }, []);

  return (
    <div className="hud-grid" style={{ height: "100vh", display: "flex", position: "relative" }}>
      <div className="scanline" />
      {/* Sidebar */}
      <div className="flex flex-col justify-between py-4 px-2" style={{ width: 96, borderRight: "1px solid var(--panel-border)", zIndex: 2 }}>
        <div className="flex flex-col gap-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <div key={n.id} className={`nav-item ${tab === n.id ? "active" : ""}`} onClick={() => setTab(n.id)} data-testid={`nav-${n.id}`}>
                <Icon size={20} />
                <span>{n.label}</span>
              </div>
            );
          })}
        </div>
        <div className="nav-item danger" onClick={assistant.stopAll} data-testid="nav-disconnect" style={{ color: "var(--red-soft)" }}>
          <Power size={20} />
          <span>DÉCONNEXION</span>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-col flex-1" style={{ zIndex: 2, minWidth: 0 }}>
        <TopBar assistant={assistant} />
        <div className="flex-1" style={{ minHeight: 0, overflow: "hidden", padding: "16px 8px 0" }}>
          {tab === "dashboard" ? (
            <div className="grid h-full gap-4" style={{ gridTemplateColumns: "340px 1fr 360px", minHeight: 0 }}>
              <div style={{ overflowY: "auto", paddingRight: 4 }}><DashboardLeft assistant={assistant} /></div>
              <CenterStage assistant={assistant} />
              <div style={{ overflowY: "auto", paddingRight: 4 }}><DashboardRight assistant={assistant} /></div>
            </div>
          ) : (
            <div className="grid h-full gap-4" style={{ gridTemplateColumns: "1fr 380px", minHeight: 0 }}>
              <div style={{ overflowY: "auto", paddingRight: 6 }}>
                {tab === "applications" && <ApplicationsView assistant={assistant} />}
                {tab === "files" && <FilesView assistant={assistant} />}
                {tab === "network" && <NetworkView assistant={assistant} />}
                {tab === "security" && <SecurityView assistant={assistant} />}
                {tab === "system" && <SystemView />}
                {tab === "settings" && <Settings onSaved={setConfig} />}
              </div>
              <div style={{ minHeight: 0 }}><CenterStage assistant={assistant} /></div>
            </div>
          )}
        </div>
        <VoiceConsole assistant={assistant} />
      </div>
    </div>
  );
}
