import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { ProprietarioForm } from "../ProprietarioForm";

export default async function NovoProprietario({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href="/admin/proprietarios">Proprietários</Link><span>/</span><span>Novo</span></div>
        <h1>Novo proprietário</h1>
      </section>
      <Aviso erro={erro} />
      <div className="cols"><ProprietarioForm /></div>
    </>
  );
}
