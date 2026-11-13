import { getDocumentProxy } from "unpdf";
import type { Pagina } from "./superlogica.ts";

type Item = { x: number; y: number; w: number; s: string };

/** Texto do PDF linha a linha, por página, com colunas separadas por 4 espaços (como o "pdftotext -layout"). */
export async function paginasDoPdf(dados: Uint8Array): Promise<Pagina[]> {
  const pdf = await getDocumentProxy(dados);
  const paginas: Pagina[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    const its: Item[] = (tc.items as { str?: string; transform?: number[]; width?: number }[])
      .filter((i) => i.str?.trim() && i.transform)
      .map((i) => ({ x: i.transform![4], y: i.transform![5], w: i.width ?? 0, s: i.str! }));
    its.sort((a, b) => b.y - a.y || a.x - b.x);
    const linhas: { y: number; its: Item[] }[] = [];
    for (const it of its) {
      const l = linhas.find((l) => Math.abs(l.y - it.y) < 3);
      if (l) l.its.push(it); else linhas.push({ y: it.y, its: [it] });
    }
    paginas.push(linhas.map((l) => {
      l.its.sort((a, b) => a.x - b.x);
      let s = "", fim: number | null = null;
      for (const it of l.its) {
        if (fim != null) { const gap = it.x - fim; s += gap > 12 ? "    " : gap > 1.5 && !s.endsWith(" ") && !it.s.startsWith(" ") ? " " : ""; }
        s += it.s; fim = it.x + it.w;
      }
      return s.replace(/\s+$/, "");
    }));
  }
  await pdf.destroy();
  return paginas;
}
