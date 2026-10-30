import { Aviso } from "@/components/Aviso";
import { definirSenha } from "@/app/login/actions";

export default async function DefinirSenha({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand"><i />ImobAI</div>
        <Aviso erro={erro} />
        <form action={definirSenha} className="panel">
          <span className="label">Criar senha</span>
          <div className="field"><label className="label" htmlFor="senha">Nova senha</label>
            <input id="senha" name="senha" type="password" minLength={8} required autoComplete="new-password" />
            <small>Mínimo de 8 caracteres.</small></div>
          <div className="field"><label className="label" htmlFor="confirmacao">Repita a senha</label>
            <input id="confirmacao" name="confirmacao" type="password" minLength={8} required autoComplete="new-password" /></div>
          <button className="btn primary">Salvar e entrar</button>
        </form>
      </div>
    </div>
  );
}
