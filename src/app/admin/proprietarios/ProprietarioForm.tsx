import type { Proprietario } from "@/lib/types";
import { salvarProprietario } from "../actions";

export function ProprietarioForm({ p, outros = [] }: { p?: Proprietario; outros?: { id: string; nome: string }[] }) {
  return (
    <form action={salvarProprietario} className="panel">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="field"><label className="label" htmlFor="nome">Nome completo / razão social</label>
        <input id="nome" name="nome" required defaultValue={p?.nome} /></div>
      <div className="row2">
        <div className="field"><label className="label" htmlFor="cpf_cnpj">CPF / CNPJ</label>
          <input id="cpf_cnpj" name="cpf_cnpj" defaultValue={p?.cpf_cnpj ?? ""} /></div>
        <div className="field"><label className="label" htmlFor="telefone">Telefone</label>
          <input id="telefone" name="telefone" defaultValue={p?.telefone ?? ""} /></div>
      </div>
      <div className="field"><label className="label" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" defaultValue={p?.email ?? ""} />
        <small>É o login do proprietário no portal.</small></div>
      <div className="row2">
        <div className="field"><label className="label" htmlFor="pix">Chave PIX</label>
          <input id="pix" name="pix" defaultValue={p?.pix ?? ""} /></div>
        <div className="field"><label className="label" htmlFor="dados_bancarios">Dados bancários</label>
          <input id="dados_bancarios" name="dados_bancarios" placeholder="Banco, agência, conta" defaultValue={p?.dados_bancarios ?? ""} /></div>
      </div>
      <div className="sec-h" style={{ marginTop: 4 }}><h2>Cobranças</h2></div>
      <div className="row2">
        <div className="field"><label className="label" htmlFor="forma_padrao">Como paga as contas</label>
          <select id="forma_padrao" name="forma_padrao" defaultValue={p?.forma_padrao ?? "cobranca"}>
            <option value="cobranca">Cobrança semanal (depósito ou Pix)</option>
            <option value="repasse">Desconto no repasse</option>
          </select></div>
        <div className="field"><label className="label" htmlFor="aprova_ate">Aprovação automática até (R$)</label>
          <input id="aprova_ate" name="aprova_ate" inputMode="decimal" defaultValue={p?.aprova_ate ?? 300} />
          <small>Contas fixas e consertos até este valor não pedem resposta.</small></div>
      </div>
      <div className="field"><label className="label" htmlFor="pagador_id">Quem paga as cobranças</label>
        <select id="pagador_id" name="pagador_id" defaultValue={p?.pagador_id ?? ""}>
          <option value="">O próprio proprietário</option>
          {outros.filter((o) => o.id !== p?.id).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <small>Ex.: o irmão sócio que paga pelos dois. As contas deste cadastro entram na cobrança dele.</small></div>
      <label className="tog"><input type="checkbox" name="desconta_vencidas" defaultChecked={p?.desconta_vencidas ?? true} />
        <span>Descontar cobranças vencidas no repasse<small>No fechamento do repasse, o que estiver vencido e sem pagamento sai do valor a receber.</small></span></label>
      <div className="field"><label className="label" htmlFor="observacoes">Observações</label>
        <textarea id="observacoes" name="observacoes" defaultValue={p?.observacoes ?? ""} /></div>
      <div className="actions"><button className="btn primary">Salvar</button></div>
    </form>
  );
}
