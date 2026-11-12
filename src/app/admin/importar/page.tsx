import { exigirAdmin } from "@/lib/auth";
import { Importador } from "./Importador";

export default async function Importar() {
  await exigirAdmin();
  return (
    <>
      <section className="hero">
        <div className="label">Imobiliária</div>
        <h1>Importar planilha</h1>
        <p className="muted">Para cadastrar a carteira de uma vez: proprietários, condomínios, imóveis e contratos, cada um numa aba.</p>
        <div className="actions"><a className="btn" href="/admin/importar/modelo">Baixar o modelo em Excel</a></div>
      </section>
      <div className="panel" style={{ maxWidth: 860, gap: 8 }}>
        <div className="sec-h"><h2>Como preencher</h2></div>
        <ol className="small muted" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
          <li>Baixe o modelo e apague a linha de exemplo de cada aba. Não mude os nomes das abas nem a ordem das colunas.</li>
          <li><b style={{ color: "var(--fg)" }}>Proprietários:</b> o e-mail vira o login dele no portal. “Quem paga as contas” só para quem tem as contas pagas por outro (ex.: o irmão sócio).</li>
          <li><b style={{ color: "var(--fg)" }}>Imóveis:</b> escreva o condomínio e os proprietários com o mesmo nome das outras abas. Sem condomínio, o imóvel é avulso e precisa de endereço.</li>
          <li><b style={{ color: "var(--fg)" }}>Contratos:</b> só para imóveis alugados. Datas como 01/06/2025.</li>
          <li>O que já está cadastrado com o mesmo nome não é alterado nem duplicado.</li>
        </ol>
      </div>
      <Importador />
    </>
  );
}
