import { Aviso } from "@/components/Aviso";
import { exigirAdmin } from "@/lib/auth";
import { lerConfig } from "@/lib/cobrancas";
import { salvarConfig } from "../cobrancas/actions";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const { supabase } = await exigirAdmin();
  const c = await lerConfig(supabase);
  return (
    <>
      <section className="hero"><div className="label">Imobiliária</div><h1>Configurações</h1></section>
      <Aviso ok={ok} erro={erro} />
      <form action={salvarConfig} className="panel" style={{ maxWidth: 720 }}>
        <div className="sec-h"><h2>Dados para pagamento</h2></div>
        <p className="small muted" style={{ margin: 0 }}>Aparecem na cobrança semanal e no e-mail.</p>
        <div className="field"><label className="label" htmlFor="favorecido">Favorecido</label><input id="favorecido" name="favorecido" defaultValue={c.favorecido ?? ""} placeholder="Mattos Imóveis Ltda" /></div>
        <div className="row2">
          <div className="field"><label className="label" htmlFor="banco">Banco e conta</label><input id="banco" name="banco" defaultValue={c.banco ?? ""} placeholder="Itaú · ag 0000 · cc 00000-0" /></div>
          <div className="field"><label className="label" htmlFor="pix">Chave Pix</label><input id="pix" name="pix" defaultValue={c.pix ?? ""} /></div>
        </div>
        <div className="sec-h" style={{ marginTop: 6 }}><h2>Cobrança semanal</h2></div>
        <div className="row3">
          <div className="field"><label className="label" htmlFor="cobranca_dia">Dia de gerar</label>
            <select id="cobranca_dia" name="cobranca_dia" defaultValue={c.cobranca_dia}>{DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
          <div className="field"><label className="label" htmlFor="cobranca_prazo">Prazo para pagar (dias)</label><input id="cobranca_prazo" name="cobranca_prazo" inputMode="numeric" defaultValue={c.cobranca_prazo} /></div>
          <div className="field"><label className="label" htmlFor="abono_ate">Abonar diferença até (R$)</label><input id="abono_ate" name="abono_ate" inputMode="decimal" defaultValue={c.abono_ate} />
            <small>Ex.: depositou R$ 2.550,00 de R$ 2.551,30.</small></div>
        </div>
        <div className="sec-h" style={{ marginTop: 6 }}><h2>Repasse</h2></div>
        <div className="field" style={{ maxWidth: 240 }}><label className="label" htmlFor="repasse_dia">Dia do repasse no mês seguinte</label>
          <input id="repasse_dia" name="repasse_dia" inputMode="numeric" defaultValue={c.repasse_dia} />
          <small>O proprietário vê “Você recebe … dia {c.repasse_dia}”.</small></div>
        <div className="actions"><button className="btn primary">Salvar</button></div>
      </form>
    </>
  );
}
