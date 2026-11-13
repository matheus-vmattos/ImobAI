# ImobAI

Banco de imóveis de proprietários com portal web. A imobiliária cadastra proprietários, condomínios, imóveis e contratos. Cada proprietário entra com o próprio login e vê só o que é dele.

**Stack:** Next.js 15 (App Router) + Supabase (Postgres, Auth, Storage).

## Fases

1. **Cadastros e login** ✅: proprietários, condomínios, imóveis (com coproprietários e %), contratos, devolução, portal do proprietário (leitura)
2. **Despesas** ✅: lançamento em condomínio (rateio por cotas, % ou valor fixo, com cotas fora da carteira) ou imóvel avulso, PDF, taxa de administração opcional, aprovação pelo proprietário (descontar / reembolso / eu mesmo pago) e confirmação de reembolso pela imobiliária
3. **Renovação** ✅: nos 90 dias antes do fim do contrato, o proprietário escolhe renovar pelo valor atual, propor novo valor ou não renovar (com comentário). A imobiliária vê as respostas e registra a renovação (novo contrato, +12 meses por padrão) ou a não renovação (imóvel entra em devolução)
4. **Repasse e e-mails** ✅: relatório mensal por proprietário (aluguel − taxa de administração − seguro − despesas marcadas para desconto), fechado pela imobiliária e visível no portal, com impressão/PDF. Avisos por e-mail de despesa enviada, respostas do proprietário, reembolso confirmado, renovação e repasse fechado, mais lembretes diários (prazo vencido e renovação sem resposta)

5. **Conta corrente do proprietário** ✅:
   - **Cobrança semanal:** as contas que o proprietário paga por depósito ou Pix viram uma cobrança só por semana, enviada por e-mail. O proprietário paga com um ou mais comprovantes, a imobiliária confere e diferenças pequenas são abonadas (limite configurável). Pagamento parcial fica em aberto, sobra vira crédito, correções entram como ajuste na semana seguinte e cobrança vencida pode sair do repasse.
   - **Extrato** no portal, com cobranças, pagamentos, abonos e saldo.
   - **Aluguel recebido:** a imobiliária marca o que o inquilino pagou; o repasse usa só o recebido.
   - **Quem paga:** condomínio ordinário e IPTU de imóvel locado ficam com o inquilino; condomínio que o dono paga direto só fica registrado.
   - **Aprovação automática:** contas fixas e consertos até o limite de cada proprietário entram direto; orçamento e valores maiores pedem resposta.
   - **Contas mensais** (zelador, lixo, água, luz) lançadas sozinhas e **lançamento de vários PDFs** de uma vez.
   - **Terceiros** fora da carteira com a parte de cada um; **vários logins** por proprietário e **pagador do grupo** (ex.: o irmão sócio).
   - **IPTU e nº de cliente** de energia e água no imóvel do portal (do condomínio ou do próprio imóvel).

6. **Segurança, portal e importação** ✅:
   - **Dinheiro:** confirmar pagamento, emitir cobrança e fechar ou reabrir repasse são funções do banco (uma transação cada). A resposta do proprietário trava depois de cobrada. Toda operação fica em **Admin → Atividade** (quem, quando, quanto), sem edição.
   - **Datas** no horário de São Paulo; dia do repasse configurável.
   - **Portal:** aluguel do mês pago, a receber ou atrasado; imóvel vago há quantos dias; histórico de cada unidade; sócio vê se a parte dele foi paga e por quem; telas de espera e botões que não aceitam clique duplo.
   - **Contas que voltam pelo inquilino** (migração `0012`): no condomínio marcado "o proprietário paga e o inquilino reembolsa", o proprietário paga 100% pela cobrança semanal e a parte de cada unidade alugada volta pelo inquilino no repasse. Toda despesa leva uma marca visível ao proprietário: **será rateada** (padrão) ou **do proprietário** (obras e extras); a imobiliária pode trocar. O proprietário pode **questionar** a despesa e a resposta aparece no portal. **A cobrar dos inquilinos** lista a parte de cada unidade por mês, para lançar no boleto e marcar.
   - **Visão do proprietário** (**Admin → Visão do proprietário** ou "Ver o portal como ele vê" no cadastro): abre o portal exatamente como o proprietário vê, só leitura. O servidor manda o cabeçalho `x-ver-como` e o banco (`ver_como()`, migração `0011`) aplica as regras de acesso daquele proprietário.
   - **Aluguel sem controle de pago/atrasado** (padrão): o recebimento fica no ERP da imobiliária; o portal mostra só o valor e o repasse usa o contrato. Dá para ligar em Configurações.
   - **Contratos vencidos** e **que vencem em até 90 dias**: filtros em Imóveis, com a decisão do proprietário (aguardando, renovar, novo valor, não renovar).
   - **Importar carteira** (**Admin → Importar carteira**): aceita os relatórios em PDF da Superlógica (imóveis + contratos em andamento) ou o modelo em Excel com 4 abas. Conferência com erros e avisos, importação "tudo ou nada". Imóveis de "Rateio" ficam de fora, unidades repetidas viram aviso, e reimportar **atualiza** (aluguel, inquilino, término, situação) sem duplicar, pelo código do sistema anterior. Contratos sem início/dia de vencimento no PDF entram com datas estimadas e marcados **datas a conferir** até alguém salvar o contrato.

O design segue `prototipo/v2/` (maquetes em HTML; gere os `.html` a partir dos `.src.html`). O protótipo antigo está em `prototipo/index.html`.

## Como rodar

### 1. Criar o projeto no Supabase
1. Crie um projeto em https://supabase.com (plano gratuito serve).
2. No **SQL Editor**, rode os arquivos de `supabase/migrations/` em ordem (`0001_…` a `0012_…`). O `0002` cria o bucket privado `despesas` para os PDFs e o `0005`, o bucket `comprovantes`.
3. (Opcional) Rode `supabase/seed.sql` para ter dados de exemplo.
4. Em **Authentication → URL Configuration**, coloque a URL do app em *Site URL* e adicione `https://SEU-APP/auth/confirm` em *Redirect URLs* (e `http://localhost:3000/auth/confirm` para testar local).
5. (Opcional) Os e-mails padrão de convite e de redefinição de senha já funcionam: o app abre a sessão em `/auth/sessao`. Para personalizá-los, configure um SMTP próprio (exigido no plano grátis) e, em **Authentication → Email Templates**, use o link:
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=/definir-senha
   ```

### 2. Configurar e iniciar o app
```bash
cp .env.example .env.local
```
Preencha `.env.local` com a URL e as chaves do projeto (**Project Settings → API**).

```bash
npm install
```

```bash
npm run dev
```

### 3. Criar o primeiro usuário da imobiliária
1. Em **Authentication → Users → Add user**, crie seu login (e-mail + senha).
2. No SQL Editor, dê o papel de admin:
   ```sql
   update profiles set papel = 'admin'
   where id = (select id from auth.users where email = 'seu@email.com');
   ```
3. Entre em http://localhost:3000.

### E-mails
Os avisos usam o [Resend](https://resend.com). Configure `RESEND_API_KEY` e `EMAIL_FROM` (domínio verificado no Resend). Sem elas, nada é enviado, mas tudo fica registrado em **Admin → E-mails**, onde dá para ver cada mensagem.
- `EMAIL_IMOBILIARIA`: para onde vão os avisos à imobiliária (vazio = e-mails dos logins admin).
- `CRON_SECRET`: protege `/api/cron/lembretes`, a rotina diária. Na Vercel, o `vercel.json` já agenda a rota uma vez por dia. Ela lança as contas mensais, gera a cobrança semanal no dia configurado e manda os lembretes (cada um uma vez só).
- `NOME_IMOBILIARIA`: nome exibido no menu (ex.: "Mattos Imóveis").

### Cobrança semanal
Em **Admin → Configurações**, preencha favorecido, conta e Pix (aparecem na cobrança), o dia da semana de gerar, o prazo e até quanto abonar. No cadastro de cada proprietário: forma de pagamento (cobrança semanal ou desconto no repasse), limite de aprovação automática, pagador do grupo e se a cobrança vencida sai do repasse.

### Repasse
Em **Admin → Repasses**, escolha o mês, confira a prévia de cada proprietário e clique em **Fechar repasse**. O relatório fica congelado, as despesas descontadas saem das pendências e o proprietário recebe o relatório por e-mail. **Reabrir** desfaz o fechamento. O aluguel do mês vem do contrato vigente no mês (se houve renovação no meio do mês, vale o novo).

### Dar acesso a um proprietário
No cadastro do proprietário, preencha o e-mail e clique em **Enviar convite**. Ele recebe um link para criar a senha. O vínculo entre login e cadastro é feito pelo e-mail.

## Testes
```bash
npm test
```
Cobre o cálculo do rateio (`src/lib/rateio.ts`), do repasse (`src/lib/repasse.ts`), da conta corrente (`src/lib/contaCorrente.ts`: quem paga, decisão automática, alocação de pagamentos, abono e extrato) e as datas da renovação.

## Permissões
Todas as tabelas usam Row Level Security:
- **admin** (imobiliária): lê e edita tudo.
- **proprietario**: só lê os próprios imóveis, repasses, contratos, condomínios onde tem unidade e despesas enviadas a ele. Responde às despesas apenas pelas funções `responder_despesa` e `informar_reembolso`, e à renovação por `responder_renovacao`. Essas funções conferem o dono e bloqueiam alterações depois que a imobiliária confirma o reembolso ou registra a renovação.
- PDFs ficam num bucket privado e abrem por link temporário, só para quem pode ver a despesa.

A chave `SUPABASE_SERVICE_ROLE_KEY` fica só no servidor e é usada só para enviar convites, guardar e abrir os PDFs e montar/registrar os e-mails, sempre depois de checar a permissão de quem pediu (ou, no cron, o `CRON_SECRET`).

## Deploy
Vercel: importe o repositório, configure as mesmas variáveis do `.env.local` e ajuste `NEXT_PUBLIC_SITE_URL` para a URL final. No Supabase, use a mesma URL em *Site URL* e `https://SEU-APP/**` em *Redirect URLs*.
As fontes ficam em `src/app/fonts` (licença OFL), então o build não depende do Google Fonts.
