/** Mostra ?erro= ou ?ok= vindos de um redirect de server action. */
export function Aviso({ erro, ok }: { erro?: string; ok?: string }) {
  if (erro) return <div className="alert erro" role="alert">{erro}</div>;
  if (ok) return <div className="alert ok" role="status">{ok}</div>;
  return null;
}

export type AvisoParams = Promise<{ erro?: string; ok?: string }>;
