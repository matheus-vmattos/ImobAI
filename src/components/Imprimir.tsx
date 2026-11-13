"use client";

export function Imprimir() {
  return <button type="button" className="btn" onClick={() => window.print()}>Imprimir / salvar PDF</button>;
}
