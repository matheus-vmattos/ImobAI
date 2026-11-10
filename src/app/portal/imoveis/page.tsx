import { getSessao } from "@/lib/auth";
import { carregarPortal } from "../dados";
import { Predios } from "../Predios";
import { predios } from "../resumo";

export default async function MeusImoveis() {
  const { supabase, proprietarioIds } = await getSessao();
  const { imoveis, condominios } = await carregarPortal(supabase, proprietarioIds);
  const lista = predios(imoveis, condominios);
  const alugados = imoveis.filter((i) => i.status === "locado").length;
  return (
    <>
      <section className="hero"><h1>Seus imóveis</h1><p className="muted">{imoveis.length} imóveis · {alugados} alugados · toque num prédio para ver as unidades</p></section>
      {lista.length ? <Predios lista={lista} /> : <div className="empty">Ainda não há imóveis no seu cadastro.</div>}
    </>
  );
}
