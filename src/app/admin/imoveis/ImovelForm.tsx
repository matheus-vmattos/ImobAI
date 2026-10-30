import { STATUS_LABEL, STATUS_ORDEM, type Imovel } from "@/lib/types";
import { salvarImovel } from "../actions";
import { DonosInput } from "./DonosInput";

export function ImovelForm({ imovel, condominios, proprietarios, donos, condominioInicial }: {
  imovel?: Imovel;
  condominios: { id: string; nome: string }[];
  proprietarios: { id: string; nome: string }[];
  donos: { proprietario_id: string; percentual: string }[];
  condominioInicial?: string;
}) {
  const i = imovel;
  return (
    <form action={salvarImovel} className="panel">
      {i && <input type="hidden" name="id" value={i.id} />}
      <div className="row2">
        <div className="field"><label className="label" htmlFor="condominio_id">Condomínio</label>
          <select id="condominio_id" name="condominio_id" defaultValue={i?.condominio_id ?? condominioInicial ?? ""}>
            <option value="">Imóvel avulso (sem condomínio)</option>
            {condominios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select></div>
        <div className="field"><label className="label" htmlFor="identificacao">Identificação</label>
          <input id="identificacao" name="identificacao" required placeholder="Apto 302, Casa, Sala 804" defaultValue={i?.identificacao} /></div>
      </div>
      <div className="row2">
        <div className="field"><label className="label" htmlFor="endereco">Endereço</label>
          <input id="endereco" name="endereco" defaultValue={i?.endereco ?? ""} />
          <small>Obrigatório para imóvel avulso.</small></div>
        <div className="field"><label className="label" htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={i?.tipo ?? "Apartamento"}>
            {["Apartamento", "Casa", "Sala comercial", "Loja", "Terreno", "Outro"].map((t) => <option key={t}>{t}</option>)}
          </select></div>
      </div>
      <DonosInput opcoes={proprietarios} inicial={donos} />
      <div className="row3">
        <div className="field"><label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={i?.status ?? "vazio"}>
            {STATUS_ORDEM.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select></div>
        <div className="field"><label className="label" htmlFor="cotas">Cotas no rateio</label>
          <input id="cotas" name="cotas" inputMode="decimal" defaultValue={i?.cotas ?? 1} /></div>
        <div className="field"><label className="label" htmlFor="taxa_adm_pct">Taxa de adm. (%)</label>
          <input id="taxa_adm_pct" name="taxa_adm_pct" inputMode="decimal" defaultValue={i?.taxa_adm_pct ?? 10} /></div>
      </div>
      <div className="row2">
        <div className="field"><label className="label" htmlFor="aluguel_pedido">Aluguel pedido (R$)</label>
          <input id="aluguel_pedido" name="aluguel_pedido" inputMode="decimal" defaultValue={i?.aluguel_pedido ?? ""} /></div>
        <div className="field"><label className="label" htmlFor="seguro_incendio_mensal">Seguro incêndio mensal (R$)</label>
          <input id="seguro_incendio_mensal" name="seguro_incendio_mensal" inputMode="decimal" defaultValue={i?.seguro_incendio_mensal ?? ""} /></div>
      </div>
      <div className="field"><label className="label" htmlFor="motivo_indisponivel">Motivo (se indisponível)</label>
        <input id="motivo_indisponivel" name="motivo_indisponivel" placeholder="Em reforma até jan/2027" defaultValue={i?.motivo_indisponivel ?? ""} /></div>
      <div className="field"><label className="label" htmlFor="observacoes">Observações</label>
        <textarea id="observacoes" name="observacoes" defaultValue={i?.observacoes ?? ""} /></div>
      <div className="actions"><button className="btn primary">Salvar imóvel</button></div>
    </form>
  );
}
