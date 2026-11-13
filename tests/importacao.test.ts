import { test } from "node:test";
import assert from "node:assert/strict";
import { dataISO, MODELO, numero, validar, type Abas } from "../src/lib/importacao.ts";

const abas = (o: Partial<Record<keyof typeof MODELO, unknown[][]>>): Abas =>
  Object.fromEntries((Object.keys(MODELO) as (keyof typeof MODELO)[]).map((k) => [k, [[...MODELO[k]], ...(o[k] ?? [])]])) as Abas;

test("números e datas no formato brasileiro", () => {
  assert.equal(numero("2.200,50"), 2200.5);
  assert.equal(numero("R$ 1.941,30"), 1941.3);
  assert.equal(numero(10), 10);
  assert.equal(numero(""), null);
  assert.ok(Number.isNaN(numero("abc")));
  assert.equal(dataISO("01/04/2024"), "2024-04-01");
  assert.equal(dataISO("1/4/24"), "2024-04-01");
  assert.equal(dataISO(new Date("2024-04-01T00:00:00Z")), "2024-04-01");
  assert.equal(dataISO("31/02/2024"), "");
});

test("planilha completa: proprietários, condomínio, imóveis e contrato", () => {
  const r = validar(abas({
    "Proprietários": [["Eduardo Castro", "", "edu@x.com", "", "", "", "cobrança", ""], ["Rafael Castro", "", "", "", "", "", "", "Eduardo Castro"]],
    "Condomínios": [["Ed. Valoriza I", "Rua 06, 120", "Goiânia", 22, "101", "300", "500"]],
    "Imóveis": [
      ["Ed. Valoriza I", "Apto 101", "", "Apartamento", "alugado", 1, 10, "1.600,00", 18, "", "Eduardo Castro", 50, "Rafael Castro", 50],
      ["ed. valoriza i", "Apto 102", "", "", "vago", "", "", "", "", "", "Eduardo Castro"],
      ["", "Loja", "Av. Central, 10", "Loja", "", "", "", "", "", "proprietário", "Eduardo Castro", 100],
    ],
    "Contratos": [["Ed. Valoriza I", "apto 101", "Maria", "", "1.600,00", "01/06/2025", "31/05/2027", 5]],
  }));
  assert.deepEqual(r.erros, []);
  assert.equal(r.proprietarios.length, 2);
  assert.equal(r.proprietarios[1].pagador, "Eduardo Castro");
  assert.equal(r.imoveis.length, 3);
  assert.deepEqual(r.imoveis[0].donos, [{ nome: "Eduardo Castro", percentual: 50 }, { nome: "Rafael Castro", percentual: 50 }]);
  assert.equal(r.imoveis[1].donos[0].percentual, 100);
  assert.equal(r.imoveis[2].condominio_pago_por, "proprietario");
  assert.deepEqual(r.contratos[0], { condominio: "Ed. Valoriza I", imovel: "apto 101", inquilino: "Maria", contato: null, aluguel: 1600, inicio: "2025-06-01", fim: "2027-05-31", dia_vencimento: 5, a_conferir: false });
});

test("erros apontam a aba e a linha", () => {
  const r = validar(abas({
    "Proprietários": [["Ana", "", "ana-sem-arroba"], ["Ana"]],
    "Imóveis": [["Cond. Inexistente", "Apto 1", "", "", "", "", "", "", "", "", "Ana"], ["", "Casa", "", "", "", "", "", "", "", "", "Ana"], ["", "Sala", "Rua A", "", "", "", "", "", "", "", "Ana", 60, "Beto", 40]],
    "Contratos": [["", "Sala", "João", "", 1000, "10/01/2026", "09/01/2025", 5]],
  }));
  const msgs = r.erros.map((e) => `${e.aba}:${e.linha}`);
  assert.ok(msgs.includes("Proprietários:2") && msgs.includes("Proprietários:3"));
  assert.ok(r.erros.some((e) => e.aba === "Imóveis" && e.linha === 2 && /não está na aba Condomínios/.test(e.msg)));
  assert.ok(r.erros.some((e) => e.linha === 3 && /precisa de endereço/.test(e.msg)));
  assert.ok(r.erros.some((e) => e.linha === 4 && /"Beto" não está/.test(e.msg)));
  assert.ok(r.erros.some((e) => e.aba === "Contratos" && /fim é antes/.test(e.msg)));
});

test("o que já existe não é duplicado; alugado sem contrato entra como vago", () => {
  const r = validar(abas({
    "Proprietários": [["Carlos Menezes"], ["Novo Dono"]],
    "Imóveis": [["", "Casa 9", "Rua B, 1", "", "alugado", "", "", "", "", "", "Carlos Menezes"]],
  }), { proprietarios: ["carlos menezes"], condominios: [], imoveis: [] });
  assert.deepEqual(r.erros, []);
  assert.deepEqual(r.proprietarios.map((p) => p.nome), ["Novo Dono"]);
  assert.equal(r.imoveis[0].status, "vazio");
  assert.equal(r.avisos.length, 2);
});

test("imóvel já cadastrado é atualizado e pode receber contrato; vago encerra o contrato", () => {
  const r = validar(abas({
    "Imóveis": [
      ["Ed. A", "Apto 1", "", "", "vago", "", 8, "1.900,00", "", "", "", "", "", "", "", "", "I 10", "123-4"],
      ["Ed. A", "Apto 2", "", "", "alugado"],
    ],
    "Contratos": [["Ed. A", "Apto 2", "João", "", "2000", "01/01/2026", "30/06/2028", "", "sim"]],
  }), { proprietarios: [], condominios: ["Ed. A"], imoveis: ["ed. a|apto 1", "ed. a|apto 2"] });
  assert.deepEqual(r.erros, []);
  assert.equal(r.imoveis.length, 2);
  assert.ok(r.imoveis.every((i) => i.existe));
  assert.equal(r.imoveis[0].vagou, true);
  assert.equal(r.imoveis[0].codigo, "I 10");
  assert.equal(r.imoveis[0].iptu_inscricao, "123-4");
  assert.equal(r.imoveis[1].vagou, false);
  assert.equal(r.contratos[0].a_conferir, true);
});
