import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularRateio, distribuir } from "../src/lib/rateio.ts";

const dono = (id: string, p = 100) => [{ proprietarioId: id, percentual: p }];
const taxa = () => 10;

test("distribuir não perde centavos", () => {
  const v = distribuir(100, [1, 1, 1]);
  assert.deepEqual(v, [33.34, 33.33, 33.33]);
  assert.equal(Math.round(v.reduce((a, b) => a + b) * 100), 10000);
});

test("12 cotas com 10 unidades na carteira: 2 cotas ficam fora", () => {
  const unidades = Array.from({ length: 10 }, (_, i) => ({ imovelId: "u" + i, quantidade: 1, donos: dono("p" + i) }));
  const r = calcularRateio({ total: 1048.8, regra: "cotas", divisor: 12, unidades, cobraTaxa: false, taxaPct: taxa });
  assert.equal(r.erro, null);
  assert.equal(r.itens[0].valor, 87.4);
  assert.equal(r.carteira, 874);
  assert.equal(r.fora, 174.8);
});

test("8 cotas: unidades acima do divisor dão erro", () => {
  const unidades = Array.from({ length: 10 }, (_, i) => ({ imovelId: "u" + i, quantidade: 1, donos: dono("p") }));
  const r = calcularRateio({ total: 800, regra: "cotas", divisor: 8, unidades, cobraTaxa: false, taxaPct: taxa });
  assert.match(r.erro!, /acima de 8/);
});

test("coproprietários 50/50 e taxa de administração", () => {
  const r = calcularRateio({ total: 520, regra: "integral", unidades: [{ imovelId: "loja", quantidade: 1, donos: [{ proprietarioId: "c", percentual: 50 }, { proprietarioId: "a", percentual: 50 }] }], cobraTaxa: true, taxaPct: taxa });
  assert.equal(r.erro, null);
  assert.deepEqual(r.itens.map((i) => [i.proprietarioId, i.valor, i.taxaAdm]), [["c", 260, 26], ["a", 260, 26]]);
  assert.equal(r.fora, 0);
});

test("percentual e valor fixo", () => {
  const u = [{ imovelId: "a", quantidade: 30, donos: dono("x") }, { imovelId: "b", quantidade: 20, donos: dono("y") }];
  const p = calcularRateio({ total: 1000, regra: "percentual", unidades: u, cobraTaxa: false, taxaPct: taxa });
  assert.deepEqual(p.porUnidade.map((x) => x.valor), [300, 200]);
  assert.equal(p.fora, 500);
  const f = calcularRateio({ total: 100, regra: "fixo", unidades: u, cobraTaxa: false, taxaPct: taxa });
  assert.equal(f.fora, 50);
});

test("unidade sem dono bloqueia", () => {
  const r = calcularRateio({ total: 100, regra: "cotas", divisor: 2, unidades: [{ imovelId: "a", quantidade: 1, donos: [] }], cobraTaxa: false, taxaPct: taxa });
  assert.match(r.erro!, /sem proprietário/);
});
