import { test } from "node:test";
import assert from "node:assert/strict";
import { ALUGUEL_TXT, situacaoAluguel, vencimentoDoMes } from "../src/lib/aluguel.ts";

test("vencimento do mês respeita meses curtos", () => {
  assert.equal(vencimentoDoMes("2026-02", 31), "2026-02-28");
  assert.equal(vencimentoDoMes("2026-11", 5), "2026-11-05");
  assert.equal(vencimentoDoMes("2026-11", null), "2026-11-10");
});

test("situação do aluguel: pago, parcial, a receber e atrasado", () => {
  const a = { vencimento: "2026-11-05", valor: 2000, recebidoEm: null, valorRecebido: null };
  assert.equal(situacaoAluguel(a, "2026-11-03").situacao, "a-receber");
  assert.equal(situacaoAluguel(a, "2026-11-05").situacao, "a-receber");
  const atr = situacaoAluguel(a, "2026-11-12");
  assert.equal(atr.situacao, "atrasado");
  assert.equal(atr.diasAtraso, 7);
  assert.equal(ALUGUEL_TXT(atr), "Aluguel atrasado há 7 dias");
  assert.equal(situacaoAluguel({ ...a, recebidoEm: "2026-11-04", valorRecebido: 2000 }, "2026-11-12").situacao, "pago");
  assert.equal(situacaoAluguel({ ...a, recebidoEm: "2026-11-04", valorRecebido: 1500 }, "2026-11-12").situacao, "parcial");
});
