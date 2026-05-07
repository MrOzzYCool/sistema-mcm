"use client";

import { useState, useRef, useEffect } from "react";
import { Clock } from "lucide-react";

interface Props {
  value: string;
  onChange: (time: string) => void;
  label?: string;
}

type Mode = "hour" | "minute";

const HOURS = [18, 19, 20, 21, 22, 23];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export default function ClockTimePicker({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("hour");
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [selectedMinute, setSelectedMinute] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Parse existing value
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(":").map(Number);
      setSelectedHour(h);
      setSelectedMinute(m);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setMode("hour");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectHour(h: number) {
    setSelectedHour(h);
    setMode("minute");
  }

  function selectMinute(m: number) {
    setSelectedMinute(m);
    const h = selectedHour ?? 18;
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    onChange(timeStr);
    setOpen(false);
    setMode("hour");
  }

  // Calculate position on circle
  function getPosition(index: number, total: number, radius: number) {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    return { x, y };
  }

  const displayValue = value ? value.slice(0, 5) : "";

  return (
    <div className="relative" ref={ref}>
      {label && <label className="block text-sm font-medium text-mcm-text mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 border border-mcm-border rounded-lg px-3 py-2 text-sm text-left focus:ring-2 focus:ring-[#a93526] focus:outline-none hover:border-[#a93526] transition-colors"
      >
        <Clock size={14} className="text-mcm-muted" />
        <span className={displayValue ? "text-mcm-text font-medium" : "text-mcm-muted"}>
          {displayValue || "Seleccionar hora"}
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 bg-white border border-mcm-border rounded-2xl shadow-xl p-4 w-[260px] left-1/2 -translate-x-1/2">
          {/* Header */}
          <div className="flex items-center justify-center gap-1 mb-3">
            <button
              type="button"
              onClick={() => setMode("hour")}
              className={`text-2xl font-bold px-2 py-1 rounded-lg transition-colors ${
                mode === "hour" ? "text-[#a93526] bg-red-50" : "text-mcm-muted hover:text-mcm-text"
              }`}
            >
              {selectedHour !== null ? String(selectedHour).padStart(2, "0") : "--"}
            </button>
            <span className="text-2xl font-bold text-mcm-muted">:</span>
            <button
              type="button"
              onClick={() => selectedHour !== null && setMode("minute")}
              className={`text-2xl font-bold px-2 py-1 rounded-lg transition-colors ${
                mode === "minute" ? "text-[#a93526] bg-red-50" : "text-mcm-muted hover:text-mcm-text"
              }`}
            >
              {selectedMinute !== null ? String(selectedMinute).padStart(2, "0") : "--"}
            </button>
          </div>

          {/* Clock face */}
          <div className="relative w-[220px] h-[220px] mx-auto">
            {/* Circle background */}
            <div className="absolute inset-0 rounded-full bg-slate-50 border border-slate-200" />

            {/* Center dot */}
            <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-[#a93526] rounded-full -translate-x-1/2 -translate-y-1/2 z-10" />

            {/* Hand line to selected */}
            {mode === "hour" && selectedHour !== null && (
              (() => {
                const idx = HOURS.indexOf(selectedHour);
                if (idx === -1) return null;
                const pos = getPosition(idx, HOURS.length, 75);
                return (
                  <div
                    className="absolute top-1/2 left-1/2 origin-left h-[2px] bg-[#a93526] z-5"
                    style={{
                      width: 75,
                      transform: `rotate(${Math.atan2(pos.y, pos.x)}rad)`,
                    }}
                  />
                );
              })()
            )}
            {mode === "minute" && selectedMinute !== null && (
              (() => {
                const idx = MINUTES.indexOf(selectedMinute);
                if (idx === -1) return null;
                const pos = getPosition(idx, MINUTES.length, 75);
                return (
                  <div
                    className="absolute top-1/2 left-1/2 origin-left h-[2px] bg-[#a93526] z-5"
                    style={{
                      width: 75,
                      transform: `rotate(${Math.atan2(pos.y, pos.x)}rad)`,
                    }}
                  />
                );
              })()
            )}

            {/* Numbers */}
            {mode === "hour" && HOURS.map((h, i) => {
              const pos = getPosition(i, HOURS.length, 82);
              const isSelected = selectedHour === h;
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => selectHour(h)}
                  className={`absolute w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    isSelected
                      ? "bg-[#a93526] text-white shadow-md scale-110"
                      : "hover:bg-red-50 text-mcm-text hover:text-[#a93526]"
                  }`}
                  style={{
                    top: `calc(50% + ${pos.y}px - 18px)`,
                    left: `calc(50% + ${pos.x}px - 18px)`,
                  }}
                >
                  {h}
                </button>
              );
            })}

            {mode === "minute" && MINUTES.map((m, i) => {
              const pos = getPosition(i, MINUTES.length, 82);
              const isSelected = selectedMinute === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => selectMinute(m)}
                  className={`absolute w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    isSelected
                      ? "bg-[#a93526] text-white shadow-md scale-110"
                      : "hover:bg-red-50 text-mcm-text hover:text-[#a93526]"
                  }`}
                  style={{
                    top: `calc(50% + ${pos.y}px - 18px)`,
                    left: `calc(50% + ${pos.x}px - 18px)`,
                  }}
                >
                  {String(m).padStart(2, "0")}
                </button>
              );
            })}
          </div>

          {/* Footer hint */}
          <p className="text-center text-xs text-mcm-muted mt-3">
            {mode === "hour" ? "Selecciona la hora" : "Selecciona los minutos"}
          </p>
        </div>
      )}
    </div>
  );
}
