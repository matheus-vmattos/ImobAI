import Link from "next/link";
import { ALUGUEL_TXT } from "@/lib/aluguel";
import { getSessao } from "@/lib/auth";
import { BRL0 } from "@/lib/format";
import { carregarPortal } from "../dados";
import { Predios } from "../Predios";
import { COR_IMOVEL, predios, SITUACAO_IMOVEL } from "../resumo";

export default async function MeusImoveis({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { ver } = await searchParams;
  const { supabase, proprietarioIds } = await getSessao();
  const { imoveis, condominios } = await carregarPortal(supabase, proprietarioIds);
  const lista = predios(imoveis, condominios);
  const alugados = imoveis.filter((i) => i.status === "locado").length;
  const atrasados = imoveis.filter((i) => i.aluguelMes?.situacao === "atrasado");
  const vagos = imoveis.filter((i) => i.status === "vazio").sort((a, b) => b.diasNaSituacao - a.diasNaSituacao);
  const filtro = ver === "atrasados" || ver === "vagos" ? ver : "predios";
  const sel = filtro === "atrasados" ? atrasados : vagos;
  const nomeCondo = (id: string | null) => condominios.find((c) => c.id && c.id === id)?.nome;
  return (
    <>
      <section className="hero"><h1>Seus imóveis</h1><p className="muted">{imoveis.length} imóveis · {alugados} alugados</p>
        <div className="filters">
          <Link href="/portal/imoveis" aria-pressed={filtro === "predios"}>Por prédio <span className="n">{lista.length}</span></Link>
          {atrasados.length > 0 && <Link href="/portal/imoveis?ver=atrasados" aria-pressed={filtro === "atrasados"}>Aluguel atrasado <span className="n">{atrasados.length}</span></Link>}
          {vagos.length > 0 && <Link href="/portal/imoveis?ver=vagos" aria-pressed={filtro === "vagos"}>Vagos <span className="n">{vagos.length}</span></Link>}
        </div>
      </section>
      {filtro === "predios" ? (lista.length ? <Predios lista={lista} /> : <div className="empty">Ainda não há imóveis no seu cadastro.</div>) : (
        sel.length ? (
          <div className="cartoes">{sel.map((u) => (
            <Link key={u.id} href={`/portal/imoveis/${u.id}`} className="cartao">
              <b>{u.nome}</b><small>{nomeCondo(u.condominioId) ?? "Imóvel avulso"}</small>
              <small style={{ color: filtro === "atrasados" ? "var(--bad)" : undefined }}>{filtro === "atrasados" && u.aluguelMes ? ALUGUEL_TXT(u.aluguelMes) : `vago há ${u.diasNaSituacao} dias`}</small>
              <span className="s"><i className="dot" style={{ background: COR_IMOVEL[u.status] }} />{SITUACAO_IMOVEL[u.status]}{u.aluguel ? ` · ${BRL0(u.aluguel * u.percentual / 100)}` : ""}</span>
            </Link>
          ))}</div>
        ) : <div className="empty">{filtro === "atrasados" ? "Nenhum aluguel atrasado." : "Nenhum imóvel vago."}</div>
      )}
    </>
  );
}
