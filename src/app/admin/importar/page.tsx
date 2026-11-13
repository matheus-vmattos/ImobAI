import { exigirAdmin } from "@/lib/auth";
import { Importador } from "./Importador";

export default async function Importar() {
  await exigirAdmin();
  return (
    <>
      <section className="hero">
        <div className="label">Imobiliária</div>
        <h1>Importar carteira</h1>
        <p className="muted">Envie os relatórios em PDF da Superlógica (imóveis e contratos) ou a planilha do modelo. Serve para cadastrar e também para atualizar.</p>
        <div className="actions"><a className="btn" href="/admin/importar/modelo">Baixar o modelo em Excel</a></div>
      </section>
      <div className="panel" style={{ maxWidth: 860, gap: 8 }}>
        <div className="sec-h"><h2>Relatórios da Superlógica</h2></div>
        <ol className="small muted" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
          <li>Envie juntos o relatório de <b style={{ color: "var(--fg)" }}>imóveis</b> (com proprietários) e o de <b style={{ color: "var(--fg)" }}>contratos em andamento</b>, em PDF.</li>
          <li>Imóveis de “Rateio” ficam de fora; unidades repetidas aparecem como aviso e entra só a que tem contrato.</li>
          <li>Como o relatório de contratos não traz início nem dia de vencimento, eles são estimados e o contrato fica marcado <b style={{ color: "var(--fg)" }}>datas a conferir</b>.</li>
          <li>Reenviar depois atualiza aluguel, inquilino, término e situação, sem duplicar.</li>
        </ol>
      </div>
      <div className="panel" style={{ maxWidth: 860, gap: 8 }}>
        <div className="sec-h"><h2>Planilha do modelo</h2></div>
        <ol className="small muted" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
          <li>Baixe o modelo e apague a linha de exemplo de cada aba. Não mude os nomes das abas nem a ordem das colunas.</li>
          <li><b style={{ color: "var(--fg)" }}>Proprietários:</b> o e-mail vira o login dele no portal. “Quem paga as contas” só para quem tem as contas pagas por outro (ex.: o irmão sócio).</li>
          <li><b style={{ color: "var(--fg)" }}>Imóveis:</b> escreva o condomínio e os proprietários com o mesmo nome das outras abas. Sem condomínio, o imóvel é avulso e precisa de endereço.</li>
          <li><b style={{ color: "var(--fg)" }}>Contratos:</b> só para imóveis alugados. Datas como 01/06/2025.</li>
          <li>Imóvel já cadastrado com o mesmo nome é atualizado (os proprietários dele não mudam). Proprietários e condomínios já cadastrados não são alterados.</li>
        </ol>
      </div>
      <Importador />
    </>
  );
}
