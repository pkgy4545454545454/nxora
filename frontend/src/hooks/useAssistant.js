import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { useSpeech, speak, stopSpeaking } from "@/lib/speech";

const SESSION_KEY = "jarvis_session";

function getSession() {
  let s = localStorage.getItem(SESSION_KEY);
  if (!s) {
    s = "sess-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(SESSION_KEY, s);
  }
  return s;
}

export function useAssistant(config) {
  const sessionId = useRef(getSession()).current;
  const [messages, setMessages] = useState([]);
  const [state, setState] = useState("idle"); // idle|listening|thinking|executing|speaking|error
  const [currentTool, setCurrentTool] = useState("");
  const [continuous, setContinuous] = useState(false);
  const continuousRef = useRef(false);
  const busyRef = useRef(false);

  const voiceCfg = config?.voice || {};
  const { supported, listening, interim, start, stop } = useSpeech({
    lang: voiceCfg.lang || "fr-FR",
    wakeWord: config?.wake_word || "jarvis",
  });

  useEffect(() => {
    api.history(sessionId).then((d) => {
      if (d.messages?.length) setMessages(d.messages.map((m) => ({ role: m.role, text: m.text })));
    }).catch(() => {});
  }, [sessionId]);

  const send = useCallback(async (text) => {
    if (!text || busyRef.current) return;
    busyRef.current = true;
    setMessages((m) => [...m, { role: "user", text }]);
    setState("thinking");
    // pause mic while processing/speaking to avoid echo
    stop();
    try {
      const res = await api.chat(sessionId, text);
      if (res.tools_used?.length) {
        setCurrentTool(res.tools_used[res.tools_used.length - 1]);
        setState("executing");
      }
      (res.open_urls || []).forEach((u) => { try { window.open(u, "_blank"); } catch (_) {} });
      const reply = res.reply || "";
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
      if (res.ok === false && res.needs_key) setState("error");
      setState("speaking");
      speak(reply, {
        voiceName: voiceCfg.name,
        rate: voiceCfg.rate ?? 1,
        pitch: voiceCfg.pitch ?? 1,
        volume: voiceCfg.volume ?? 1,
        lang: voiceCfg.lang || "fr-FR",
        onEnd: () => {
          setState("idle");
          setCurrentTool("");
          busyRef.current = false;
          if (continuousRef.current) startListening();
        },
      });
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: "Erreur de communication avec le serveur." }]);
      setState("error");
      busyRef.current = false;
      setTimeout(() => setState("idle"), 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, voiceCfg.name, voiceCfg.rate, voiceCfg.pitch, voiceCfg.volume, voiceCfg.lang, stop]);

  const onFinal = useCallback((transcript) => {
    if (busyRef.current) return;
    const wake = (config?.wake_word || "jarvis").toLowerCase();
    let t = transcript;
    const low = t.toLowerCase();
    if (low.includes(wake)) {
      t = t.replace(new RegExp(wake, "ig"), "").trim();
      if (!t) return;
    }
    send(t);
  }, [config, send]);

  const startListening = useCallback(() => {
    if (!supported) return;
    setState("listening");
    start(onFinal);
  }, [supported, start, onFinal]);

  const toggleContinuous = useCallback(() => {
    const next = !continuousRef.current;
    continuousRef.current = next;
    setContinuous(next);
    if (next) startListening();
    else { stop(); stopSpeaking(); setState("idle"); }
  }, [startListening, stop]);

  const stopAll = useCallback(() => {
    continuousRef.current = false;
    setContinuous(false);
    stop();
    stopSpeaking();
    busyRef.current = false;
    setState("idle");
  }, [stop]);

  const clear = useCallback(async () => {
    await api.clearHistory(sessionId);
    setMessages([]);
  }, [sessionId]);

  return {
    sessionId, messages, state, currentTool, interim, listening, continuous,
    supported, send, toggleContinuous, startListening, stopAll, clear, setMessages,
  };
}
