import React from "react";

export function Panel({ title, titleClass = "", right, children, className = "", red = false, testid }) {
  return (
    <div className={`panel ${red ? "red" : ""} ${className} fade-in`} data-testid={testid}>
      {(title || right) && (
        <div className="flex items-center justify-between">
          {title && <div className={`panel-title ${red ? "red" : ""} ${titleClass}`}>{title}</div>}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function CircularGauge({ value = 0, label, sub, color = "cyan", size = 92 }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  const col = color === "red" ? "#ff3b52" : color === "amber" ? "#ffb648" : color === "green" ? "#39e6a0" : "#23a8ff";
  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(120,150,190,0.14)" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth={stroke} fill="none"
            strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${col})`, transition: "stroke-dasharray .6s ease" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0 }} className="flex flex-col items-center justify-center">
          {label && <div className="font-display" style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: 1 }}>{label}</div>}
          <div className="font-display" style={{ fontSize: 18, fontWeight: 700, color: col }}>{Math.round(pct)}%</div>
        </div>
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{sub}</div>}
    </div>
  );
}

export function MiniBar({ label, value, icon, color = "cyan", right }) {
  return (
    <div className="list-row">
      {icon && <div style={{ width: 22, textAlign: "center", color: "var(--cyan-bright)" }}>{icon}</div>}
      <div className="flex-1">
        <div className="flex justify-between" style={{ fontSize: 13 }}>
          <span style={{ color: "var(--text)" }}>{label}</span>
          {right && <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{right}</span>}
        </div>
        {typeof value === "number" && (
          <div className={`track ${color === "red" ? "red" : ""}`} style={{ marginTop: 5 }}>
            <div style={{ width: `${Math.min(100, value)}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

export function Sparkline({ data = [], color = "#23a8ff", height = 60 }) {
  const w = 260;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * w;
    const y = height - ((d - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}
