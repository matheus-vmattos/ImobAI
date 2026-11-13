import { test } from "node:test";
import assert from "node:assert/strict";
import { estimarDatas, lerContratos, lerImoveis, limparPaginas, montarAbas, quebrarEndereco, tipoDeRelatorio, unidade } from "../src/lib/superlogica.ts";
import { validar } from "../src/lib/importacao.ts";

// dados fictícios, no formato dos relatórios da Superlógica
const rodape = ["Imobiliária Exemplo Ltda.", "Rua Um, 1, Centro"];
const imoveis = limparPaginas([[
  "Imóveis de Alfa Empreendimentos Ltda.",
  "Imóvel 100 - Rua das Flores nº20, Rateio, Centro, Cidade-RJ CEP: 28000-000    Imóvel vazio",
  "Aluguel 0,00    Repasse    Taxa de adm. 0,00 %",
  "Proprietários",
  "Alfa Empreendimentos    CNPJ 00.000.000/0001-00    Repasse 100,00% ( Proprietário principal )",
  "Ltda.",
  "Imóvel I 201 - Rua das Flores nº20, Apto 101, Centro, Cidade-RJ CEP: 28000-000",
  "Aluguel 1.500,00    Repasse    Taxa de adm. 10,00 %",
  "Código SPU    Código IPTU 555-1",
  "Código água 0012 - 3    Código sequencial",
  "Observação Luz e água independente.",
  "Proprietários",
  "Alfa Empreendimentos    CNPJ 00.000.000/0001-00    Repasse 100,00% ( Proprietário principal )",
  "Ltda.",
  ...rodape, "1 de 2",
], [
  "Imóvel I 202 - Rua das Flores nº20, Aptº 102 - Bloco Fundos, Centro, Cidade-RJ CEP: 28000-000    Imóvel vazio",
  "Aluguel 1.400,00    Repasse    Taxa de adm. 8,00 %",
  "Código SPU    Código IPTU 555-1",
  "Proprietários",
  "Alfa Empreendimentos Ltda.    CNPJ 00.000.000/0001-00    Repasse 100,00% ( Proprietário principal )",
  "Imóvel 202 - Rua das Flores nº20, Lt 2, Apto 102, Bloco Fundos, Centro, Cidade-RJ CEP: 28000-000    Imóvel vazio",
  "Aluguel 1.400,00    Repasse    Taxa de adm. 8,00 %",
  "Proprietários",
  "Alfa Empreendimentos Ltda.    CNPJ 00.000.000/0001-00    Repasse 100,00% ( Proprietário principal )",
  ...rodape, "2 de 2",
]]);
const contratos = [
  "Contratos", "Em andamento", "Lista de contratos",
  "Contrato I 201/2 Apartamento no Centro, Rua das Flores 20 Apto 101 , CEP: 28000-000    R$ 1.500,00",
  "04/2028",
  "Taxa de adm",
  "Alfa Empreendimentos Ltda.",
  "Maria da Silva    R$ 150,00",
];

test("lê o relatório de imóveis (sem rodapé, nome em duas linhas)", () => {
  assert.equal(tipoDeRelatorio(imoveis), "imoveis");
  const r = lerImoveis(imoveis);
  assert.equal(r.length, 4);
  assert.equal(imoveis.some((l) => l.includes("Imobiliária Exemplo")), false);
  assert.deepEqual(r[1], { codigo: "I 201", endereco: "Rua das Flores nº20, Apto 101, Centro, Cidade-RJ CEP: 28000-000", vazio: false, aluguel: 1500, taxa: 10,
    iptu: "555-1", agua: "0012-3", energia: null, observacao: "Luz e água independente.", donos: [{ nome: "Alfa Empreendimentos Ltda.", doc: "00.000.000/0001-00", percentual: 100 }] });
});

test("lê o relatório de contratos", () => {
  assert.equal(tipoDeRelatorio(contratos), "contratos");
  assert.deepEqual(lerContratos(contratos), [{ codigo: "I 201", aluguel: 1500, termino: "2028-04", inquilino: "Maria da Silva", endereco: "Apartamento no Centro, Rua das Flores 20 Apto 101 , CEP: 28000-000" }]);
});

test("endereço vira condomínio + unidade", () => {
  assert.deepEqual(quebrarEndereco("Avenida Mar nºNº415, Aptº401 - Fundos, Praia, Cidade-RJ CEP: 28990-838"),
    { rua: "Avenida Mar", numero: "415", bairro: "Praia", cidade: "Cidade-RJ", cep: "28990-838", complemento: "Aptº401 - Fundos" });
  assert.equal(unidade("Aptº401 - Fundos").identificacao, "Apto 401 Fundos");
  assert.equal(unidade("Casa 08 (Bloco 04 - 102)").identificacao, "Casa 08");
  assert.equal(unidade("Apto 206 Bloco B").identificacao, "Apto 206 Bloco B");
  assert.deepEqual(estimarDatas("2026-10"), { inicio: "2024-05-01", fim: "2026-10-31", dia: 10 });
});

test("monta as abas: tira Rateio e duplicado, IPTU comum vai para o prédio", () => {
  const c = montarAbas(lerImoveis(imoveis), lerContratos(contratos));
  assert.equal(c.ignorados, 1);
  const r = validar(c.abas);
  assert.deepEqual(r.erros, []);
  assert.deepEqual(r.condominios.map((x) => [x.nome, x.iptu_inscricao]), [["das Flores 20", "555-1"]]);
  assert.deepEqual(r.imoveis.map((i) => [i.identificacao, i.codigo, i.status, i.iptu_inscricao]), [["Apto 101", "I 201", "locado", null], ["Apto 102 Fundos", "I 202", "vazio", null]]);
  assert.ok(c.avisos.some((a) => a.msg.includes("Código 202") && a.msg.includes("I 202")));
  assert.deepEqual(r.contratos.map((x) => [x.inquilino, x.inicio, x.fim, x.dia_vencimento, x.a_conferir]), [["Maria da Silva", "2025-11-01", "2028-04-30", 10, true]]);
});
