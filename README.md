# promo-bot

Worker que monitora promoções na Amazon e no Mercado Livre, filtra por desconto mínimo e categoria, e posta automaticamente num grupo do Telegram com link de afiliado.

## Como funciona

- `src/lib/scrapers/` — raspa as páginas de ofertas da Amazon e do Mercado Livre via Playwright.
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
| `ACTIVE_SOURCES` | não (default `amazon,mercadolivre`) | Fontes ativas, separadas por vírgula |
| `CATEGORY_KEYWORDS` | não | Palavras-chave (vírgula) pra filtrar por categoria no título; vazio = sem filtro |
| `AMAZON_AFFILIATE_TAG` | não | Tag do Amazon Associates |
| `MERCADOLIVRE_AFFILIATE_TAG` | não | Tag do programa de afiliados do Mercado Livre (formato provisório, ajustar quando aprovado) |

## Rodando em produção (GitHub Actions)

O workflow em `.github/workflows/check-deals.yml` roda `npm run check` a cada 30 minutos via cron do GitHub Actions — não precisa de servidor próprio.

Configure em **Settings → Secrets and variables → Actions**:

- **Secrets**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_CHAT_ID`, `REDIS_URL`, `AMAZON_AFFILIATE_TAG`, `MERCADOLIVRE_AFFILIATE_TAG`
- **Variables**: `DEAL_DISCOUNT_THRESHOLD`, `ACTIVE_SOURCES`, `CATEGORY_KEYWORDS`

## Limitações conhecidas

- Magalu está temporariamente fora: o site bloqueia o scraping mesmo com as mesmas técnicas que funcionam pra Amazon e Mercado Livre.
- Os links de afiliado do Mercado Livre usam um formato provisório até a aprovação real no programa.
- Scraping de páginas de e-commerce é inerentemente frágil — mudanças no HTML dos sites podem quebrar os seletores e exigir manutenção.
