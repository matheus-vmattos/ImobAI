# Memória do projeto ImobAI

Documento para retomar o contexto num chat novo: o que é, decisões tomadas, estado atual e pendências.
Atualizado em 13/11/2026.

## 1. O que é
- Portal da imobiliária **Valoriza Negócios Imobiliários** (Saquarema/RJ) para os proprietários.
- **Não é o ERP.** A gestão de contratos, boletos e repasse continua na **Superlógica**.
- Foco do ImobAI:
  - dar ao proprietário uma experiência simples, com o demonstrativo do que ele recebe e do que ele paga;
  - organizar as contas a pagar e a receber;
  - concentrar os pedidos de aprovação de contas e as decisões de renovação.
- Primeiro cliente real: **Itaúna Number One Empreendimentos Imobiliários Ltda.**, 1 proprietário com 44 imóveis em 4 prédios.

## 2. Como trabalhar comigo (preferências do usuário)
- Responder em português, curto e prático: a resposta direta primeiro e no máximo 5 tópicos.
- Em tarefa técnica, mostrar primeiro um plano curto e implementar depois da confirmação. Fazer no máximo 1 pergunta.
- O usuário não é técnico: o deploy e os comandos ficam por minha conta (já autorizados).
- "FECHAR CICLO" = gerar um resumo de transferência de no máximo 12 linhas.
- Nunca imprimir o valor de credenciais.

## 3. Infra
- **Repositório:** `matheus-vmattos/ImobAI`, branch `claude/fervent-galileo-5fpsry`, PR de rascunho #1.
- **Produção:** https://imobai-smoky.vercel.app. Vercel em `gru1`; deploy com `npx -y vercel@65.8.0 deploy --prod --yes`, usando o login da CLI salvo no ambiente.
- **Supabase:** projeto `orvxyeohfxdzkiritpcq`, em São Paulo.
  - As variáveis de ambiente antigas (`NEXT_PUBLIC_SUPABASE_*` etc.) apontam para um projeto apagado.
  - As chaves novas ficam no `sp.env` do scratchpad da sessão.
  - O SQL roda pela Management API (`api.supabase.com/v1/projects/<ref>/database/query`); o token é injetado pelo proxy, com `Authorization: Bearer proxy-injected`.
- **Stack:** Next.js 15 (App Router, server actions), Supabase (Postgres + RLS + Storage), testes com `node:test` (`npm test`, 32 passando) e Playwright para E2E.
- **Login de teste:** criar um usuário `@imobai.test`, testar e apagar no fim. Nunca deixar dado de teste no banco, que tem dados reais.

## 4. Estado dos dados (produção)
- Importados dos PDFs da Superlógica: 1 proprietário, 4 condomínios, 44 imóveis (38 alugados e 6 vagos) e 38 contratos.
- Condomínios: Oceânica 415, Pitatunga 13, Manoel de Souza 48, Desembargador Pache de Farias 15.
- Os 38 contratos estão com **"datas a conferir"**: o PDF não traz início nem dia de vencimento. A estimativa foi início = término − 30 meses (nunca no futuro), com vencimento no dia 10.
- Contratos vencidos: Apto 210 e Apto 212 (Manoel de Souza 48), em 31/10/2026.
- Ainda não existe: login do proprietário (falta o e-mail dele), dados de pagamento da Valoriza em Configurações e chave do Resend para e-mail.
- Só existe 1 login no banco: o admin do usuário.

## 5. Decisões de negócio
- **Importação (Admin → Importar carteira):**
  - Aceita os PDFs da Superlógica (relatório de imóveis + contratos em andamento) ou a planilha modelo.
  - Imóvel com "Rateio" no endereço fica de fora.
  - Entre duplicados, a prioridade é: tem contrato > código com "I" (o ativo) > alugado > código mais novo.
  - Reimportar atualiza sem duplicar (pelo `codigo_externo`) e não apaga as datas já conferidas.
- **Aluguel:** o recebimento fica na Superlógica.
  - `config.controla_alugueis = false`: o portal mostra só o valor do aluguel, sem pago/atrasado.
  - O repasse usa o valor do contrato. O menu Aluguéis fica escondido.
- **"Você recebe"** no portal é uma **estimativa** (aluguel − taxa − contas) e aparece como "≈ … · estimativa". O valor final vem no repasse da Superlógica.
- **Contas do prédio (fluxo real da Valoriza):**
  1. A imobiliária paga a conta.
  2. O proprietário reembolsa por depósito (cobrança semanal).
  3. A conta é rateada entre as unidades, e a parte de cada unidade alugada vai para o boleto do inquilino e volta ao proprietário no repasse.
  - Por isso o condomínio tem `inquilino_reembolsa` (ligado nos 4 prédios).
  - **Tudo volta pelo inquilino, menos obras e extras** (`extra`, `condominio_extra`).
  - Cada despesa tem uma marca visível ao proprietário: **"Despesa será rateada"** ou **"Despesa do proprietário"**. A imobiliária pode trocar, e o proprietário pode **questionar**.
- **Visão do proprietário:** o admin abre o portal como o proprietário, só leitura. Funciona pelo cabeçalho `x-ver-como` e pela função `ver_como()` no banco.
- **Contratos vencidos / que vencem em 90 dias:** filtros em Imóveis, com a decisão do proprietário sobre a renovação.
- **Recusado por enquanto:** importar as linhas do repasse da Superlógica, categorias do demonstrativo, repasse por período do contrato e taxas de contrato novo. Motivo: ficaria complexo, e o foco é a experiência e a organização.

## 6. Mapa do código (principal)
- **Migrações** `supabase/migrations/0001…0012`:
  - `0007`: segurança do dinheiro e Atividade;
  - `0009`/`0010`: importação;
  - `0011`: visão do proprietário e `controla_alugueis`;
  - `0012`: o que volta pelo inquilino e questionamentos.
- **Importação:** `src/lib/superlogica.ts` (leitura dos PDFs), `src/lib/pdfTexto.ts` (unpdf), `src/lib/importacao.ts` (validação) e `src/app/admin/importar/`.
- **Regras de quem paga:** `src/lib/contaCorrente.ts` (`responsavelPor`, `rateadaPadrao`, `voltaPeloInquilino`) e `src/lib/decisoes.ts` (`responsaveis`, `marcaRateio`).
- **Sessão:** `src/lib/auth.ts` (`getSessao`, `getSessaoPortal` com a visão do proprietário).
- **Portal:** `src/app/portal/` (início, imóveis, extrato, decidir, `MarcaDespesa.tsx`).
- **Admin:** `src/app/admin/`, incluindo `inquilinos/` (a cobrar dos inquilinos), `visao/`, `despesas/[id]` (marca e questionamentos) e `imoveis` (filtros).

## 7. Pendências e ideias
- Pegar o e-mail do proprietário e convidar para o portal.
- Preencher os dados de pagamento da Valoriza em Configurações.
- Ajustar o dia do repasse para 12 (os extratos da Superlógica vencem dia 12; hoje está 10).
- Corrigir as datas dos contratos aos poucos (filtro "Datas a conferir" em Imóveis).
- Infra:
  - Resend (SMTP e e-mails);
  - Supabase Pro, por causa do backup;
  - plano da Vercel para uso comercial.
- Ideia guardada: ler o PDF de repasse da Superlógica para trocar a estimativa pelo valor real e corrigir as datas dos contratos pelo texto "Aluguel (11/12) 10/10 a 09/11".
