import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularRepasses, contratoDoMes, mesDe } from "../src/lib/repasse.ts";

const contrato = (id: string, aluguel: number, inicio: string, fim: string) => ({ id, aluguel, inicio, fim, inquilino: "Inq " + id });

test("mesDe: último dia do mês", () => {
  assert.deepEqual(mesDe("2026-02"), { ini: "2026-02-01", fim: "2026-02-28" });
  assert.deepEqual(mesDe("2028-02"), { ini: "2028-02-01", fim: "2028-02-29" });
});

test("contratoDoMes: renovação no meio do mês fica com o contrato novo; mês sem contrato dá null", () => {
  const cs = [contrato("velho", 2000, "2025-01-16", "2026-12-15"), contrato("novo", 2200, "2026-12-16", "2027-12-15")];
  assert.equal(contratoDoMes(cs, "2026-11")?.id, "velho");
  assert.equal(contratoDoMes(cs, "2026-12")?.id, "novo");
  assert.equal(contratoDoMes(cs, "2028-01"), null);
});

test("aluguel − taxa − seguro − despesas, com coproprietários", () => {
  const imoveis = [
    { id: "apto", nome: "Apto 302", taxaPct: 10, seguro: 19.9, donos: [{ proprietarioId: "c", percentual: 100 }], contratos: [contrato("1", 2350, "2024-12-16", "2026-12-15")] },
    { id: "loja", nome: "Loja", taxaPct: 8, seguro: 54, donos: [{ proprietarioId: "c", percentual: 50 }, { proprietarioId: "a", percentual: 50 }], contratos: [contrato("2", 6500, "2023-01-01", "2027-12-31")] },
    { id: "vazio", nome: "Apto 402", taxaPct: 10, seguro: 19.9, donos: [{ proprietarioId: "c", percentual: 100 }], contratos: [] },
  ];
  const descontos = [{ itemId: "i1", proprietarioId: "c", imovelId: "apto", descricao: "Água", valor: 100, taxaAdm: 10 }];
  const [c, a] = calcularRepasses("2026-11", imoveis, descontos);
  assert.equal(c.proprietarioId, "c");
  assert.equal(c.aluguel, 2350 + 3250);
  assert.equal(c.taxa, 235 + 260);
  assert.equal(c.seguro, 19.9 + 27 + 19.9);
  assert.equal(c.despesas, 110);
  assert.equal(c.liquido, 5600 - 495 - 66.8 - 110);
  assert.deepEqual(c.itens, ["i1"]);
  assert.equal(a.liquido, 3250 - 260 - 27);
});

test("aluguel não pago pelo inquilino não entra no repasse (nem a taxa)", () => {
  const im = (recebido: number | null) => [{ id: "a", nome: "Apto 302", taxaPct: 10, seguro: null, donos: [{ proprietarioId: "c", percentual: 100 }], contratos: [{ ...contrato("1", 2350, "2024-12-16", "2026-12-15"), recebido }] }];
  const [naoPago] = calcularRepasses("2026-11", im(null), []);
  assert.equal(naoPago.aluguel, 0);
  assert.equal(naoPago.taxa, 0);
  assert.equal(naoPago.linhas[0].tipo, "pendente");
  const [parcial] = calcularRepasses("2026-11", im(2000), []);
  assert.equal(parcial.aluguel, 2000);
  assert.equal(parcial.taxa, 200);
});
