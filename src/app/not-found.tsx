import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <div className="auth"><div className="auth-card"><div className="empty">
      <b>Página não encontrada.</b>O endereço pode ter mudado.
      <Link className="btn" href="/">Voltar ao início</Link>
    </div></div></div>
  );
}
