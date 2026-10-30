# ImobAI

Banco de imóveis de proprietários com portal web. A imobiliária cadastra proprietários, condomínios, imóveis e contratos. Cada proprietário entra com o próprio login e vê só o que é dele.

**Stack:** Next.js 15 (App Router) + Supabase (Postgres, Auth, Storage).

## Fases

1. **Cadastros e login** ✅: proprietários, condomínios, imóveis (com coproprietários e %), contratos, devolução, portal do proprietário (leitura)
2. **Despesas** ✅: lançamento em condomínio (rateio por cotas, % ou valor fixo, com cotas fora da carteira) ou imóvel avulso, PDF, taxa de administração opcional, aprovação pelo proprietário (descontar / reembolso / eu mesmo pago) e confirmação de reembolso pela imobiliária
3. **Renovação** ✅: nos 90 dias antes do fim do contrato, o proprietário escolhe renovar pelo valor atual, propor novo valor ou não renovar (com comentário). A imobiliária vê as respostas e registra a renovação (novo contrato, +12 meses por padrão) ou a não renovação (imóvel entra em devolução)
4. **Repasse e e-mails** ✅: relatório mensal por proprietário (aluguel − taxa de administração − seguro − despesas marcadas para desconto), fechado pela imobiliária e visível no portal, com impressão/PDF. Avisos por e-mail de despesa enviada, respostas do proprietário, reembolso confirmado, renovação e repasse fechado, mais lembretes diários (prazo vencido e renovação sem resposta)

O protótipo visual está em `prototipo/index.html`.

## Como rodar

### 1. Criar o projeto no Supabase
1. Crie um projeto em https://supabase.com (plano gratuito serve).
2. No **SQL Editor**, rode os arquivos de `supabase/migrations/` em ordem (`0001_…` a `0004_…`). O `0002` cria o bucket privado `despesas` para os PDFs.
3. (Opcional) Rode `supabase/seed.sql` para ter dados de exemplo.
4. Em **Authentication → URL Configuration**, coloque a URL do app em *Site URL* e adicione `https://SEU-APP/auth/confirm` em *Redirect URLs* (e `http://localhost:3000/auth/confirm` para testar local).
5. Em **Authentication → Email Templates**, nos modelos *Invite user* e *Reset password*, troque o link por:
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
- `CRON_SECRET`: protege `/api/cron/lembretes`. Na Vercel, o `vercel.json` já agenda a rota uma vez por dia; cada lembrete é enviado uma vez só.

### Repasse
Em **Admin → Repasses**, escolha o mês, confira a prévia de cada proprietário e clique em **Fechar repasse**. O relatório fica congelado, as despesas descontadas saem das pendências e o proprietário recebe o relatório por e-mail. **Reabrir** desfaz o fechamento. O aluguel do mês vem do contrato vigente no mês (se houve renovação no meio do mês, vale o novo).

### Dar acesso a um proprietário
No cadastro do proprietário, preencha o e-mail e clique em **Enviar convite**. Ele recebe um link para criar a senha. O vínculo entre login e cadastro é feito pelo e-mail.

## Testes
```bash
npm test
```
Cobre o cálculo do rateio (`src/lib/rateio.ts`), do repasse (`src/lib/repasse.ts`) e as datas da renovação.

## Permissões
Todas as tabelas usam Row Level Security:
- **admin** (imobiliária): lê e edita tudo.
- **proprietario**: só lê os próprios imóveis, repasses, contratos, condomínios onde tem unidade e despesas enviadas a ele. Responde às despesas apenas pelas funções `responder_despesa` e `informar_reembolso`, e à renovação por `responder_renovacao`. Essas funções conferem o dono e bloqueiam alterações depois que a imobiliária confirma o reembolso ou registra a renovação.
- PDFs ficam num bucket privado e abrem por link temporário, só para quem pode ver a despesa.

A chave `SUPABASE_SERVICE_ROLE_KEY` fica só no servidor e é usada só para enviar convites, guardar e abrir os PDFs e montar/registrar os e-mails, sempre depois de checar a permissão de quem pediu (ou, no cron, o `CRON_SECRET`).

## Deploy
Vercel: importe o repositório, configure as mesmas variáveis do `.env.local` e ajuste `NEXT_PUBLIC_SITE_URL` para a URL final.
