import { Icon } from "@/components/Icon";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { entrar, esqueciSenha } from "./actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string; modo?: string }> }) {
  const { erro, ok, modo } = await searchParams;
  const recuperar = modo === "senha";
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand"><span className="logo"><Icon name="logo" /></span>ImobAI</div>
        <Aviso erro={erro} ok={ok} />
        {recuperar ? (
          <form action={esqueciSenha} className="panel">
            <span className="label">Recuperar acesso</span>
            <div className="field"><label className="label" htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" required autoComplete="email" /></div>
            <button className="btn primary">Enviar link</button>
            <Link href="/login" className="link">Voltar para o login</Link>
          </form>
        ) : (
          <form action={entrar} className="panel">
            <span className="label">Entrar</span>
            <div className="field"><label className="label" htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" required autoComplete="email" /></div>
            <div className="field"><label className="label" htmlFor="senha">Senha</label>
              <input id="senha" name="senha" type="password" required autoComplete="current-password" /></div>
            <button className="btn primary">Entrar</button>
            <Link href="/login?modo=senha" className="link">Esqueci minha senha / primeiro acesso</Link>
          </form>
        )}
      </div>
    </div>
  );
}
