# promo-bot

Worker que monitora promoções na Amazon e na rede de afiliados Lomadee, filtra por desconto mínimo e categoria, e posta automaticamente num grupo do Telegram com link de afiliado.

## Como funciona

- `src/lib/scrapers/amazon.ts` — raspa a página de ofertas da Amazon via Playwright.
- `src/lib/scrapers/lomadee.ts` — consulta a API de afiliados da Lomadee (produtos + link rastreado).
- `src/lib/deals/detect.ts` — calcula o % de desconto e aplica o limite mínimo (`DEAL_DISCOUNT_THRESHOLD`).
- `src/lib/deals/category-filter.ts` — filtra por palavra-chave no título (`CATEGORY_KEYWORDS`).
- `src/lib/dedup.ts` — usa Redis (com TTL) pra não postar a mesma promoção repetidamente.
- `src/lib/telegram.ts` — posta a promoção formatada no grupo configurado.

## Rodando

Copie `.env.example` para `.env` e preencha as variáveis (veja abaixo).

```bash
npm install
npx playwright install chromium
npm run check   # roda uma checagem única e sai
npm start       # roda continuamente, checando a cada CHECK_INTERVAL_MINUTES
```

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | sim | Token do bot, via @BotFather |
| `TELEGRAM_GROUP_CHAT_ID` | sim | ID do grupo onde as promoções são postadas |
| `REDIS_URL` | recomendada | Sem isso, não há dedup — a mesma promoção pode ser postada de novo a cada checagem |
| `DEAL_DISCOUNT_THRESHOLD` | não (default 40) | % mínimo de desconto pra considerar relevante |
| `ACTIVE_SOURCES` | não (default `amazon,lomadee`) | Fontes ativas, separadas por vírgula (`amazon`, `lomadee`) |
| `CATEGORY_KEYWORDS` | não | Palavras-chave EXTRAS além das embutidas (limpeza/bem-estar/cosméticos); vírgula |
| `AMAZON_AFFILIATE_TAG` | não | Tag do Amazon Associates |
| `LOMADEE_API_KEY` | não | Chave da API Lomadee (header `x-api-key`). `lmd_dev_` = sandbox; `lmd_prod_` = produção |
| `LOMADEE_ORGANIZATION_IDS` | não | IDs de marcas (organização) para restringir ao nicho; vírgula. Vazio = todas |

## Rodando em produção (GitHub Actions)

O workflow em `.github/workflows/check-deals.yml` roda `npm run check` a cada 30 minutos via cron do GitHub Actions — não precisa de servidor próprio.

Configure em **Settings → Secrets and variables → Actions**:

- **Secrets**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_CHAT_ID`, `REDIS_URL`, `AMAZON_AFFILIATE_TAG`, `LOMADEE_API_KEY`
- **Variables**: `DEAL_DISCOUNT_THRESHOLD`, `ACTIVE_SOURCES`, `CATEGORY_KEYWORDS`, `LOMADEE_ORGANIZATION_IDS`

> **Importante:** sem o secret `REDIS_URL` configurado no GitHub Actions, o dedup fica **desativado** e as mesmas promoções são repostadas a cada execução. O worker emite um `AVISO` no log quando isso acontece.

Se uma secret não tiver valor real, **não a crie** — o GitHub não aceita salvar secret vazia, e um placeholder tipo `''` é lido como valor de verdade (ver `src/lib/env.ts`).

## Afiliados

- **Amazon**: anexa `?tag={AMAZON_AFFILIATE_TAG}` na URL do produto (formato oficial Associates).
- **Lomadee**: usa a API oficial (`api.lomadee.com.br`, header `x-api-key`). Os produtos vêm do endpoint `/affiliate/products`; o link rastreado é gerado em `/affiliate/shortener/url`. **Requer um canal cadastrado no painel da Lomadee** — sem canal, a API não devolve link e o worker posta sem comissão (com aviso no log).

O **Mercado Livre** foi removido (sem afiliado automatizável) e a **Magazine Luiza** também (a página de ofertas bloqueia scraping com 403/Cloudflare, e a Magalu não é anunciante da conta Lomadee — é o programa Magazine Você, separado).

## Limitações conhecidas

- Scraping de páginas de e-commerce é inerentemente frágil — mudanças no HTML dos sites podem quebrar os seletores e exigir manutenção.
- A chave Lomadee `lmd_dev_` é sandbox (dados de teste, sem canais). Comissão real exige chave `lmd_prod_` + canal cadastrado.
