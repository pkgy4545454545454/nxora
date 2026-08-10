import { useState, useEffect, useCallback, useRef } from "react";

// Web Speech API hooks: STT (recognition) + TTS (synthesis)

export function useSpeech({ lang = "fr-FR", wakeWord = "jarvis" } = {}) {
  const [supported] = useState(
    () => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef(null);
  const onFinalRef = useRef(null);
  const keepAliveRef = useRef(false);

  const ensureRecognition = useCallback(() => {
    if (!supported) return null;
    if (recognitionRef.current) return recognitionRef.current;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let final = "";
      let temp = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else temp += t;
      }
      setInterim(temp);
      if (final && onFinalRef.current) {
        setInterim("");
        onFinalRef.current(final.trim());
      }
    };
    rec.onend = () => {
      if (keepAliveRef.current) {
        try { rec.start(); } catch (_) { /* already started */ }
      } else {
        setListening(false);
      }
    };
    rec.onerror = () => {};
    recognitionRef.current = rec;
    return rec;
  }, [supported, lang]);

  const start = useCallback((onFinal) => {
    const rec = ensureRecognition();
    if (!rec) return;
    onFinalRef.current = onFinal;
    keepAliveRef.current = true;
    try { rec.start(); setListening(true); } catch (_) {}
  }, [ensureRecognition]);

  const stop = useCallback(() => {
    keepAliveRef.current = false;
    setListening(false);
    setInterim("");
    try { recognitionRef.current && recognitionRef.current.stop(); } catch (_) {}
  }, []);

  return { supported, listening, interim, start, stop };
}

export function useVoices() {
  const [voices, setVoices] = useState([]);
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);
  return voices;
}

export function speak(text, { voiceName, rate = 1, pitch = 1, volume = 1, lang = "fr-FR", onStart, onEnd } = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis || !text) {
    onEnd && onEnd();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  u.pitch = pitch;
  u.volume = volume;
  const voices = window.speechSynthesis.getVoices();
  const v = voices.find((x) => x.name === voiceName) || voices.find((x) => x.lang && x.lang.startsWith(lang.split("-")[0]));
  if (v) u.voice = v;
  u.onstart = () => onStart && onStart();
  u.onend = () => onEnd && onEnd();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
}
