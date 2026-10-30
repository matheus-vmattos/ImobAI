/** Helpers para ler FormData em server actions. */

export const texto = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/** Aceita "1.234,56", "1234,56" e "1234.56" */
export const numero = (f: FormData, k: string) => {
  const raw = String(f.get(k) ?? "").trim();
  if (raw === "") return null;
  const norm = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
};

export const obrigatorio = (f: FormData, k: string, rotulo: string) => {
  const v = texto(f, k);
  if (!v) throw new Error(`Preencha o campo "${rotulo}".`);
  return v;
};
