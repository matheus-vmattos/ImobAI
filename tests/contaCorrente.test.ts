import { test } from "node:test";
import assert from "node:assert/strict";
import { alocar, decisaoAutomatica, extrato, fechamento, periodoDaSemana, responsavelPor } from "../src/lib/contaCorrente.ts";

test("quem paga: condomínio e IPTU de imóvel locado são do inquilino", () => {
  assert.equal(responsavelPor("condominio", "locado", "imobiliaria"), "inquilino");
  assert.equal(responsavelPor("iptu", "locado", "imobiliaria"), "inquilino");
  assert.equal(responsavelPor("condominio", "vazio", "imobiliaria"), "proprietario");
  assert.equal(responsavelPor("condominio_extra", "locado", "imobiliaria"), "proprietario");
  assert.equal(responsavelPor("condominio", "vazio", "proprietario"), "direto");
  assert.equal(responsavelPor("manutencao", "locado", "imobiliaria"), "proprietario");
});

test("decisão automática: pequena e fixa entram direto; orçamento e acima do limite pedem resposta", () => {
  const base = { responsavel: "proprietario" as const, requerAprovacao: false, aprovaAte: 300, formaPadrao: "cobranca" as const, recorrente: false };
  assert.equal(decisaoAutomatica({ ...base, valorDoProprietario: 180 }), "reembolso");
  assert.equal(decisaoAutomatica({ ...base, valorDoProprietario: 500 }), null);
  assert.equal(decisaoAutomatica({ ...base, valorDoProprietario: 1941.3, recorrente: true }), "reembolso");
  assert.equal(decisaoAutomatica({ ...base, valorDoProprietario: 100, requerAprovacao: true }), null);
  assert.equal(decisaoAutomatica({ ...base, valorDoProprietario: 100, formaPadrao: "repasse" }), "desconto");
  assert.equal(decisaoAutomatica({ ...base, valorDoProprietario: 100, responsavel: "inquilino" }), null);
});

test("período da cobrança: semana que termina na véspera da emissão", () => {
  assert.deepEqual(periodoDaSemana("2026-11-10"), { inicio: "2026-11-03", fim: "2026-11-09" });
});

test("pagamento cobre as cobranças mais antigas primeiro e guarda a sobra", () => {
  const cs = [
    { id: "nova", vencimento: "2026-11-17", emitidaEm: "2026-11-10", saldo: 514.81 },
    { id: "velha", vencimento: "2026-11-10", emitidaEm: "2026-11-03", saldo: 2551.3 },
  ];
  assert.deepEqual(alocar(cs, 2550), { alocacoes: [{ cobrancaId: "velha", valor: 2550 }], sobra: 0 });
  assert.deepEqual(alocar(cs, 3200), { alocacoes: [{ cobrancaId: "velha", valor: 2551.3 }, { cobrancaId: "nova", valor: 514.81 }], sobra: 133.89 });
});

test("abono só até o limite", () => {
  assert.deepEqual(fechamento(1.3, 5, true), { abono: 1.3, quitada: true });
  assert.deepEqual(fechamento(1.3, 5, false), { abono: 0, quitada: false });
  assert.deepEqual(fechamento(551.3, 5, true), { abono: 0, quitada: false });
  assert.deepEqual(fechamento(0, 5, true), { abono: 0, quitada: true });
});

test("extrato: cobrança, depósito e abono zeram o saldo", () => {
  const e = extrato({
    cobrancas: [{ id: "c1", emitidaEm: "2026-11-10T09:00:00Z", inicio: "2026-11-03", fim: "2026-11-09", total: 2551.3, abonado: 1.3, descontado: 0, quitadaEm: "2026-11-11T10:00:00Z", qtd: 4 }],
    pagamentos: [{ id: "p1", data: "2026-11-11", valor: 2550, forma: "deposito" }],
  });
  assert.equal(e.saldo, 0);
  assert.equal(e.movimentos.length, 3);
  assert.equal(e.movimentos.find((m) => m.tipo === "cobranca")!.descricao, "Contas da semana 03/11 a 09/11 · 4 contas");
});

test("extrato do mesmo dia: abono, pagamento e cobrança nessa ordem", () => {
  const e = extrato({
    cobrancas: [{ id: "c1", emitidaEm: "2026-11-09T09:00:00Z", inicio: "2026-11-02", fim: "2026-11-08", total: 100, abonado: 1, descontado: 0, quitadaEm: "2026-11-09T15:00:00Z", qtd: 1 }],
    pagamentos: [{ id: "p1", data: "2026-11-09", valor: 99, forma: "pix" }],
  });
  assert.deepEqual(e.movimentos.map((m) => m.tipo), ["abono", "pagamento", "cobranca"]);
});

test("prédio em que o inquilino reembolsa: o proprietário paga tudo e a parte da unidade alugada volta", async () => {
  const { responsavelPor, rateadaPadrao, voltaPeloInquilino } = await import("../src/lib/contaCorrente.ts");
  // sem o modelo: condomínio de imóvel alugado é do inquilino
  assert.equal(responsavelPor("condominio", "locado", "imobiliaria"), "inquilino");
  // com o modelo: o proprietário paga e o inquilino devolve no repasse
  assert.equal(responsavelPor("condominio", "locado", "imobiliaria", true), "proprietario");
  assert.equal(responsavelPor("iptu", "locado", "imobiliaria", true), "proprietario");
  assert.equal(responsavelPor("condominio", "locado", "proprietario", true), "direto");
  // tudo volta, menos obras e extras
  assert.equal(rateadaPadrao("manutencao", true), true);
  assert.equal(rateadaPadrao("extra", true), false);
  assert.equal(rateadaPadrao("condominio_extra", true), false);
  assert.equal(rateadaPadrao("manutencao", false), false);
  assert.equal(voltaPeloInquilino(true, "locado"), true);
  assert.equal(voltaPeloInquilino(true, "devolucao"), true);
  assert.equal(voltaPeloInquilino(true, "vazio"), false);
  assert.equal(voltaPeloInquilino(false, "locado"), false);
});
