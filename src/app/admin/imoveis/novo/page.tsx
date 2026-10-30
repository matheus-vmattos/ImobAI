import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { exigirAdmin } from "@/lib/auth";
import { ImovelForm } from "../ImovelForm";

export default async function NovoImovel({ searchParams }: { searchParams: Promise<{ erro?: string; proprietario?: string; condominio?: string }> }) {
  const { erro, proprietario, condominio } = await searchParams;
  const { supabase } = await exigirAdmin();
  const [{ data: condominios }, { data: proprietarios }] = await Promise.all([
    supabase.from("condominios").select("id, nome").order("nome"),
    supabase.from("proprietarios").select("id, nome").order("nome"),
  ]);
  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href="/admin/imoveis">Imóveis</Link><span>/</span><span>Novo</span></div>
        <h1>Novo imóvel</h1>
      </section>
      <Aviso erro={erro} />
      {!proprietarios?.length && <div className="alert">Cadastre um proprietário antes. <Link className="link" href="/admin/proprietarios/novo">Novo proprietário</Link></div>}
      <div className="cols">
        <ImovelForm
          condominios={condominios ?? []}
          proprietarios={proprietarios ?? []}
          donos={proprietario ? [{ proprietario_id: proprietario, percentual: "100" }] : []}
          condominioInicial={condominio}
        />
      </div>
    </>
  );
}
