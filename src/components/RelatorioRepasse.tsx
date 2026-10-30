import { BRL, data, nomeMes } from "@/lib/format";
import type { LinhaRepasse } from "@/lib/repasse";

export type RepasseFechado = {
  id: string; competencia: string; aluguel: number; taxa_adm: number; seguro: number; despesas: number; liquido: number;
  linhas: LinhaRepasse[]; fechado_em: string; proprietarios: { nome: string; cpf_cnpj: string | null; pix: string | null; dados_bancarios: string | null };
};

/** Relatório de repasse de um proprietário num mês (o mesmo para a imobiliária e para o proprietário). */
export function RelatorioRepasse({ r }: { r: RepasseFechado }) {
  const porImovel = new Map<string, LinhaRepasse[]>();
  r.linhas.forEach((l) => porImovel.set(l.imovel, [...(porImovel.get(l.imovel) ?? []), l]));
  const p = r.proprietarios;
  return (
    <div className="relatorio">
      <div className="kpis">
        <div className="kpi"><span className="label">Aluguel</span><span className="v">{BRL(r.aluguel)}</span><small>sua parte</small></div>
        <div className="kpi"><span className="label">Taxa adm.</span><span className="v">− {BRL(r.taxa_adm)}</span><small>sobre o aluguel</small></div>
        <div className="kpi"><span className="label">Seguro + despesas</span><span className="v">− {BRL(Number(r.seguro) + Number(r.despesas))}</span>
          <small>seguro {BRL(r.seguro)} · despesas {BRL(r.despesas)}</small></div>
        <div className="kpi"><span className="label">{r.liquido >= 0 ? "Líquido a receber" : "A pagar à imobiliária"}</span>
          <span className="v" style={{ color: "var(--accent)" }}>{BRL(Math.abs(r.liquido))}</span><small>fechado em {data(r.fechado_em)}</small></div>
      </div>

      <div className="box tbl-wrap"><table>
        <thead><tr><th>Imóvel</th><th>Lançamento</th><th className="r">Valor</th></tr></thead>
        <tbody>
          {[...porImovel].map(([imovel, ls]) => ls.map((l, i) => (
            <tr key={imovel + i}>
              <td>{i === 0 ? imovel : ""}</td>
              <td className={l.valor < 0 ? "muted" : undefined}>{l.descricao}</td>
              <td className="r num">{l.valor < 0 ? "− " : ""}{BRL(Math.abs(l.valor))}</td>
            </tr>
          )))}
          <tr className="total"><td colSpan={2}><b>{r.liquido >= 0 ? "Líquido a receber" : "A pagar à imobiliária"}</b></td><td className="r num"><b>{BRL(Math.abs(r.liquido))}</b></td></tr>
        </tbody>
      </table></div>

      <p className="small muted" style={{ margin: 0 }}>
        {p.nome}{p.cpf_cnpj ? ` · ${p.cpf_cnpj}` : ""}{p.pix ? ` · PIX ${p.pix}` : ""}{p.dados_bancarios ? ` · ${p.dados_bancarios}` : ""} · competência {nomeMes(r.competencia.slice(0, 7))}
      </p>
    </div>
  );
}

export const SELECT_REPASSE = "id, competencia, aluguel, taxa_adm, seguro, despesas, liquido, linhas, fechado_em, proprietarios(nome, cpf_cnpj, pix, dados_bancarios)";
