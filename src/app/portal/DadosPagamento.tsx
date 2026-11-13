import { Copiar } from "@/components/Copiar";

export function DadosPagamento({ pagar }: { pagar: { favorecido: string | null; banco: string | null; pix: string | null } | null }) {
  if (!pagar || (!pagar.banco && !pagar.pix)) return null;
  return (
    <div className="bankbox">
      {pagar.favorecido && <div><span>Favorecido</span><b style={{ fontWeight: 500 }}>{pagar.favorecido}</b></div>}
      {pagar.banco && <div><span>Conta</span><span className="mono">{pagar.banco}</span></div>}
      {pagar.pix && <div><span>Pix</span><span className="mono" style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{pagar.pix}</span><Copiar texto={pagar.pix} /></div>}
    </div>
  );
}
