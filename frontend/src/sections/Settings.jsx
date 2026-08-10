import React, { useState, useEffect } from "react";
import { Panel } from "@/components/Hud";
import { api } from "@/lib/api";
import { useVoices, speak } from "@/lib/speech";
import { KeyRound, Mic2, ShieldCheck, Volume2, Save } from "lucide-react";

const MODELS = [
  "claude-sonnet-4-5-20250929",
  "claude-haiku-4-5-20251001",
  "claude-opus-4-5-20251101",
  "claude-4-sonnet-20250514",
  "claude-4-opus-20250514",
];

export default function Settings({ onSaved }) {
  const [cfg, setCfg] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const voices = useVoices();
  const frVoices = voices.filter((v) => v.lang?.toLowerCase().startsWith("fr"));
  const otherVoices = voices.filter((v) => !v.lang?.toLowerCase().startsWith("fr"));

  useEffect(() => { api.config().then(setCfg).catch(() => {}); }, []);

  if (!cfg) return <div style={{ color: "var(--text-dim)" }}>Chargement…</div>;

  const upd = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const updVoice = (patch) => setCfg((c) => ({ ...c, voice: { ...c.voice, ...patch } }));
  const updPerm = (patch) => setCfg((c) => ({ ...c, permissions: { ...c.permissions, ...patch } }));

  const save = async () => {
    const patch = {
      anthropic_model: cfg.anthropic_model,
      wake_word: cfg.wake_word,
      voice: cfg.voice,
      permissions: cfg.permissions,
      cyber_authorized_targets: cfg.cyber_authorized_targets,
    };
    if (apiKey.trim()) patch.anthropic_api_key = apiKey.trim();
    const res = await api.saveConfig(patch);
    setCfg(res); setApiKey(""); setSaved(true); setTimeout(() => setSaved(false), 2000);
    onSaved && onSaved(res);
  };

  const testVoice = () => speak("Bonjour, je suis JARVIS, votre assistant personnel. Comment puis-je vous aider ?", {
    voiceName: cfg.voice?.name, rate: cfg.voice?.rate, pitch: cfg.voice?.pitch,
    volume: cfg.voice?.volume, lang: cfg.voice?.lang || "fr-FR",
  });

  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 720, margin: "0 auto", overflowY: "auto", height: "100%", paddingRight: 6 }}>
      <Panel title={<><KeyRound size={13} /> Intelligence Artificielle (Claude)</>} testid="settings-ai">
        <label className="text-xs" style={{ color: "var(--text-dim)" }}>Clé API Anthropic {cfg.anthropic_api_key_set && <span style={{ color: "var(--green)" }}>• configurée</span>}</label>
        <input className="field mt-1 font-mono" type="password" placeholder="sk-ant-..." value={apiKey}
          onChange={(e) => setApiKey(e.target.value)} data-testid="settings-apikey-input" />
        <label className="text-xs mt-3 block" style={{ color: "var(--text-dim)" }}>Modèle</label>
        <select className="field mt-1" value={cfg.anthropic_model} onChange={(e) => upd({ anthropic_model: e.target.value })} data-testid="settings-model-select">
          {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <label className="text-xs mt-3 block" style={{ color: "var(--text-dim)" }}>Mot d'activation</label>
        <input className="field mt-1" value={cfg.wake_word} onChange={(e) => upd({ wake_word: e.target.value })} data-testid="settings-wakeword-input" />
      </Panel>

      <Panel title={<><Volume2 size={13} /> Voix & Synthèse Vocale</>} testid="settings-voice">
        <label className="text-xs" style={{ color: "var(--text-dim)" }}>Voix (françaises en priorité)</label>
        <select className="field mt-1" value={cfg.voice?.name || ""} onChange={(e) => updVoice({ name: e.target.value })} data-testid="settings-voice-select">
          <option value="">Voix automatique (meilleure voix FR)</option>
          {frVoices.map((v) => <option key={v.name} value={v.name}>🇫🇷 {v.name}</option>)}
          {otherVoices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
        </select>
        {["rate", "pitch", "volume"].map((k) => (
          <div key={k} className="mt-3">
            <div className="flex justify-between text-xs" style={{ color: "var(--text-dim)" }}>
              <span>{k === "rate" ? "Vitesse" : k === "pitch" ? "Tonalité" : "Volume"}</span>
              <span>{(cfg.voice?.[k] ?? 1).toFixed(2)}</span>
            </div>
            <input type="range" min={k === "volume" ? 0 : 0.5} max={k === "volume" ? 1 : 2} step="0.05"
              value={cfg.voice?.[k] ?? 1} onChange={(e) => updVoice({ [k]: parseFloat(e.target.value) })}
              style={{ width: "100%" }} data-testid={`settings-voice-${k}`} />
          </div>
        ))}
        <button className="btn mt-3" onClick={testVoice} data-testid="settings-test-voice-btn"><Mic2 size={13} className="inline mr-1" /> Tester la voix</button>
      </Panel>

      <Panel title={<><ShieldCheck size={13} /> Permissions</>} testid="settings-permissions">
        {[["normal", "Actions normales (ouvrir, lancer, créer)"], ["sensitive", "Actions sensibles (supprimer, emails)"],
          ["terminal", "Terminal & commandes système"], ["cybersecurity", "Outils de cybersécurité"]].map(([k, label]) => (
          <label key={k} className="flex items-center justify-between py-2" style={{ fontSize: 14 }}>
            <span>{label}</span>
            <input type="checkbox" checked={cfg.permissions?.[k] ?? true} onChange={(e) => updPerm({ [k]: e.target.checked })} data-testid={`settings-perm-${k}`} />
          </label>
        ))}
      </Panel>

      <button className="btn" onClick={save} data-testid="settings-save-btn" style={{ position: "sticky", bottom: 0 }}>
        <Save size={13} className="inline mr-1" /> {saved ? "Enregistré ✓" : "Enregistrer la configuration"}
      </button>
    </div>
  );
}
