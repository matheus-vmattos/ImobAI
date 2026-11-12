import writeExcelFile from "write-excel-file/node";
import { NextResponse } from "next/server";
import { MODELO, type NomeAba } from "@/lib/importacao";
import { createClient } from "@/lib/supabase/server";

const EXEMPLO: Record<NomeAba, (string | number)[][]> = {
  "Proprietários": [["Eduardo Castro (exemplo: apague esta linha)", "000.000.000-00", "eduardo@exemplo.com", "(62) 99999-0000", "eduardo@exemplo.com", "Itaú ag 0000 cc 00000-0", "cobrança", ""]],
  "Condomínios": [["Ed. Exemplo (apague esta linha)", "Rua 06, 120", "Goiânia", 12, "101.001.0001", "3000000001", "50001"]],
  "Imóveis": [["Ed. Exemplo (apague esta linha)", "Apto 101", "", "Apartamento", "alugado", 1, 10, 1600, 18, "imobiliária", "Eduardo Castro (exemplo: apague esta linha)", 100, "", "", "", ""]],
  "Contratos": [["Ed. Exemplo (apague esta linha)", "Apto 101", "Maria da Silva", "(62) 98888-0000", 1600, "01/06/2025", "31/05/2027", 5]],
};

/** Modelo de planilha para importar a carteira (4 abas, com uma linha de exemplo em cada). */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autorizado", { status: 401 });
  const sheets = (Object.keys(MODELO) as NomeAba[]).map((aba) => ({
    sheet: aba,
    data: [MODELO[aba].map((t) => ({ value: t, fontWeight: "bold" as const })), ...EXEMPLO[aba].map((l) => l.map((v) => ({ value: v })))],
    columns: MODELO[aba].map((t) => ({ width: Math.min(46, Math.max(16, t.length + 2)) })),
    stickyRowsCount: 1,
  }));
  const buffer = await writeExcelFile(sheets).toBuffer();
  return new NextResponse(new Uint8Array(buffer), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": 'attachment; filename="modelo-carteira.xlsx"',
  } });
}
