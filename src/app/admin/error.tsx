"use client";

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="empty" role="alert">
      <b>Não conseguimos abrir esta tela.</b>
      Pode ter sido a conexão. Nada do que você fez foi perdido.
      <button className="btn" onClick={reset}>Tentar de novo</button>
    </div>
  );
}
