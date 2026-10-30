# ImobAI

Banco de imóveis de proprietários com portal web. A imobiliária cadastra proprietários, condomínios, imóveis e contratos. Cada proprietário entra com o próprio login e vê só o que é dele.

**Stack:** Next.js 15 (App Router) + Supabase (Postgres, Auth, Storage).

## Fases

1. **Cadastros e login** ✅: proprietários, condomínios, imóveis (com coproprietários e %), contratos, devolução, portal do proprietário (leitura)
2. Despesas com PDF, rateio por cotas e aprovação (descontar / reembolso / eu mesmo pago)
3. Renovação de contrato pelo proprietário
4. Notificações por e-mail e relatório de repasse

O protótipo visual está em `prototipo/index.html`.

## Como rodar

### 1. Criar o projeto no Supabase
1. Crie um projeto em https://supabase.com (plano gratuito serve).
2. No **SQL Editor**, rode `supabase/migrations/0001_fase1_cadastros.sql`.
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

### Dar acesso a um proprietário
No cadastro do proprietário, preencha o e-mail e clique em **Enviar convite**. Ele recebe um link para criar a senha. O vínculo entre login e cadastro é feito pelo e-mail.

## Permissões
Todas as tabelas usam Row Level Security:
- **admin** (imobiliária): lê e edita tudo.
- **proprietario**: só lê os próprios imóveis, contratos e condomínios onde tem unidade.

A chave `SUPABASE_SERVICE_ROLE_KEY` fica só no servidor e é usada apenas para enviar convites, depois de checar que quem pediu é admin.

## Deploy
Vercel: importe o repositório, configure as mesmas variáveis do `.env.local` e ajuste `NEXT_PUBLIC_SITE_URL` para a URL final.
