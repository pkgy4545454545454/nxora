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

// Shared lip-sync level (0..1) read by the 3D avatar
export const mouth = { level: 0 };
let _mouthRAF = null;

function startMouthDecay() {
  cancelAnimationFrame(_mouthRAF);
  const tick = () => {
    mouth.level *= 0.86;
    if (mouth.level < 0.01) mouth.level = 0;
    _mouthRAF = requestAnimationFrame(tick);
  };
  tick();
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
  u.onstart = () => { startMouthDecay(); onStart && onStart(); };
  u.onboundary = () => { mouth.level = 0.55 + Math.random() * 0.45; };
  u.onend = () => { cancelAnimationFrame(_mouthRAF); mouth.level = 0; onEnd && onEnd(); };
  // fallback pulsing in case onboundary is not fired by the browser
  const pulse = setInterval(() => {
    if (!window.speechSynthesis.speaking) { clearInterval(pulse); return; }
    mouth.level = Math.max(mouth.level, 0.4 + Math.random() * 0.5);
  }, 140);
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  cancelAnimationFrame(_mouthRAF);
  mouth.level = 0;
}

// Short rising "wake" chime played when JARVIS hears its wake word
let _actx = null;
export function playWake() {
  try {
    _actx = _actx || new (window.AudioContext || window.webkitAudioContext)();
    if (_actx.state === "suspended") _actx.resume();
    const t = _actx.currentTime;
    const o = _actx.createOscillator();
    const g = _actx.createGain();
    o.connect(g); g.connect(_actx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(660, t);
    o.frequency.exponentialRampToValueAtTime(1320, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.start(t); o.stop(t + 0.3);
  } catch (e) { /* ignore */ }
}
