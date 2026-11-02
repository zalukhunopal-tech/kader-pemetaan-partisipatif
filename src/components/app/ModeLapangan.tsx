import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { bacaModeTampilan, simpanModeTampilan, ModeTampilan } from "../../lib/tampilanLapangan";
export function ModeLapangan() {
  const [mode, setMode] = useState(bacaModeTampilan);
  useEffect(() => {
    simpanModeTampilan(mode);
  }, [mode]);
  return (
    <div className="field-mode-controls">
      <span>
        {mode === "matahari" ? <Sun size={16} /> : mode === "malam" ? <Moon size={16} /> : <Monitor size={16} />} Tampilan lapangan
      </span>
      <select aria-label="Mode tampilan lapangan" value={mode} onChange={(e) => setMode(e.target.value as ModeTampilan)}>
        <option value="standar">Standar</option>
        <option value="matahari">Sinar matahari</option>
        <option value="malam">Hutan malam</option>
      </select>
    </div>
  );
}
