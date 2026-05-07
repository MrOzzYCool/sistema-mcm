"use client";

import { useState, useRef, useEffect } from "react";
import { Clock } from "lucide-react";

interface Props {
  value: string;
  onChange: (time: string) => void;
  label?: string;
}

const HOURS = ["18", "19", "20", "21", "22"];
const MINUTES = ["00", "15", "30", "45"];

export default function ClockTimePicker({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      {label && <label className="block text-sm font-medium text-mcm-text mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 border border-mcm-border rounded-lg px-3 py-2 text-sm text-left focus:ring-2 focus:ring-[#a93526] focus:outline-none"
      >
        <Clock size={14} className="text-mcm-muted" />
        <span className={value ? "text-mcm-text" : "text-mcm-muted"}>
          {value || "Seleccionar hora"}
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 bg-white border border-mcm-border rounded-xl shadow-lg p-3 w-48">
          <div className="grid grid-cols-4 gap-1">
            {HOURS.flatMap(h =>
              MINUTES.map(m => {
                const time = `${h}:${m}`;
                const isSelected = value === time;
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => { onChange(time); setOpen(false); }}
                    className={`px-1.5 py-1 rounded text-xs font-mono transition-colors ${
                      isSelected
                        ? "bg-[#a93526] text-white"
                        : "hover:bg-red-50 text-mcm-text"
                    }`}
                  >
                    {time}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
