import type { Proprietario } from "@/lib/types";
import { salvarProprietario } from "../actions";

export function ProprietarioForm({ p }: { p?: Proprietario }) {
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
      <div className="field"><label className="label" htmlFor="observacoes">Observações</label>
        <textarea id="observacoes" name="observacoes" defaultValue={p?.observacoes ?? ""} /></div>
      <div className="actions"><button className="btn primary">Salvar</button></div>
    </form>
  );
}
