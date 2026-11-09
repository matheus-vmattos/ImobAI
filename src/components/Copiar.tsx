"use client";

import { useState } from "react";

export function Copiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="btn sm" onClick={() => { navigator.clipboard?.writeText(texto); setOk(true); setTimeout(() => setOk(false), 1500); }}>
      {ok ? "Copiado" : "Copiar"}
    </button>
  );
}
