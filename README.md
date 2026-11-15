# ⚡ ZapPrático

SaaS em português para pequenos negócios **criarem bots de vendas no WhatsApp**, com mini-loja online, PIX, comandas de pedidos, analytics e assinaturas.

## Funcionalidades

- 🤖 **Bots de WhatsApp** com construtor visual de fluxos, templates prontos e respostas por IA (WhatsApp Cloud API / Meta)
- ✨ **Assistente de criação por IA** — descreva o negócio e receba persona, fluxo, produtos e mensagens prontas
- 🛍️ **Mini-loja pública** (`/loja/seu-slug`): catálogo, carrinho, checkout, acompanhamento de pedido, temas e editor com preview
- 💸 **PIX**: chave manual, Mercado Pago ou Asaas (com split de taxa da plataforma)
- 📦 **Pedidos/comandas**, mensagens rápidas, exportação CSV/PDF
- 📊 **Dashboard e analytics** com receita, pedidos e alertas
- 💳 **Assinaturas** (Free / Pro / Business) com Stripe
- 🔐 Autenticação, RLS por dono dos dados e painel admin (Supabase)

## Stack

TanStack Start (React 19 + SSR) · TypeScript · Tailwind CSS v4 · shadcn/ui · Supabase (Postgres + Auth + Storage) · Stripe · Nitro (servidor Node)

## Rodando localmente

Requisitos: **Node 22+** e um projeto gratuito no [Supabase](https://supabase.com).

```bash
npm install
cp .env.example .env        # preencha com suas chaves
npm run dev                 # http://localhost:3000
```

### 1) Banco de dados (Supabase)

Crie um projeto no Supabase e aplique as migrations (tabelas, RLS, buckets de storage, triggers):

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Depois copie `Project URL`, `anon key` e `service_role key` (Settings → API) para o `.env`.

> Dica: em *Authentication → Providers → Email* você pode desativar "Confirm email" durante os testes.

**Virar admin:** cadastre-se no app e, no SQL Editor do Supabase, rode:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'seu@email.com';
```

### 2) IA

Defina `AI_API_KEY`. Por padrão usa o **Google Gemini** (tem plano gratuito, chave em <https://aistudio.google.com/apikey>). Para usar outro provedor compatível com a API da OpenAI, mude `AI_BASE_URL` e `AI_MODEL` (exemplos no `.env.example`).

### 3) Stripe (opcional — só para cobrar assinaturas)

1. Crie dois **preços recorrentes** com *lookup keys* exatamente `pro_monthly` e `business_monthly` (Product catalog → Price → *Advanced → Lookup key*).
2. Preencha `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` (ambas `test` ou ambas `live`).
3. Crie um webhook apontando para `https://SEU_DOMINIO/api/public/payments/webhook?env=sandbox` (use `env=live` em produção) com os eventos `customer.subscription.created|updated|deleted` e copie o `whsec_...` para `STRIPE_WEBHOOK_SECRET`.
   Local: `stripe listen --forward-to localhost:3000/api/public/payments/webhook?env=sandbox`.

### 4) WhatsApp (opcional)

No [Meta for Developers](https://developers.facebook.com/) crie um app com WhatsApp Cloud API, coloque o *App Secret* em `WHATSAPP_APP_SECRET` e configure o webhook com a URL `https://SEU_DOMINIO/api/public/whatsapp/webhook`. O token de verificação e as credenciais de cada bot são cadastrados dentro do app (tela de bots).

## Deploy

O build gera um servidor Node autônomo:

```bash
npm run build
npm start        # node .output/server/index.mjs (PORT=3000)
```

**Docker:**

```bash
docker compose up --build -d
```

Funciona em qualquer host que rode Node/Docker (Railway, Render, Fly.io, VPS…). Lembre-se: as variáveis `VITE_*` são embutidas **no build**; as demais são lidas em runtime. Os webhooks (Stripe, WhatsApp, PIX) exigem uma URL pública com HTTPS.

## Estrutura

```
src/
  routes/        páginas e endpoints (/api/public/*)
  server/        lógica de servidor (IA, PIX, monetização)
  lib/           server functions, helpers (Stripe, planos, PIX…)
  components/    UI (shadcn/ui + componentes do app)
  integrations/  cliente Supabase e tipos do banco
supabase/migrations/   schema completo do banco
```

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` / `npm start` | build e execução em produção |
| `npm run typecheck` | checagem de tipos |
| `npm run lint` | ESLint |

## Licença

MIT
