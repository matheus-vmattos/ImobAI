import { exigirAdmin } from "@/lib/auth";
import { verComo } from "./actions";

/** Escolher o proprietário para ver o portal como ele vê. */
export default async function Visao() {
  const { supabase } = await exigirAdmin();
  const { data } = await supabase.from("proprietarios").select("id, nome, imovel_proprietarios(imovel_id)").order("nome");
  const props = (data ?? []) as unknown as { id: string; nome: string; imovel_proprietarios: { imovel_id: string }[] }[];
  return (
    <>
      <section className="hero">
        <div className="label">Carteira</div>
        <h1>Visão do proprietário</h1>
        <p className="muted">Abra o portal exatamente como o proprietário vê. É só leitura: nada que você clicar lá responde por ele.</p>
      </section>
      {props.length ? (
        <div className="box">{props.map((p) => (
          <form key={p.id} action={verComo} className="mv">
            <input type="hidden" name="proprietario_id" value={p.id} />
            <span className="t"><b>{p.nome}</b><small>{p.imovel_proprietarios.length} imóve{p.imovel_proprietarios.length === 1 ? "l" : "is"}</small></span>
            <button className="btn sm">Ver como ele</button>
          </form>
        ))}</div>
      ) : <div className="empty">Nenhum proprietário cadastrado.</div>}
    </>
  );
}
