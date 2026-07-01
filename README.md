# promo-bot

Worker que monitora promoções na Amazon e no Magazine Luiza, filtra por desconto mínimo e categoria, e posta automaticamente num grupo do Telegram com link de afiliado.

## Como funciona

- `src/lib/scrapers/` — raspa as páginas de ofertas da Amazon e do Magazine Luiza via Playwright.
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
| `ACTIVE_SOURCES` | não (default `amazon,magalu`) | Fontes ativas, separadas por vírgula (`amazon`, `magalu`) |
| `CATEGORY_KEYWORDS` | não | Palavras-chave EXTRAS além das embutidas (limpeza/bem-estar/cosméticos); vírgula |
| `AMAZON_AFFILIATE_TAG` | não | Tag do Amazon Associates |
| `MAGALU_STORE_NAME` | não | Nome da sua loja no Magazine Você (URL `magazinevoce.com.br/{nome}`) |

## Rodando em produção (GitHub Actions)

O workflow em `.github/workflows/check-deals.yml` roda `npm run check` a cada 30 minutos via cron do GitHub Actions — não precisa de servidor próprio.

Configure em **Settings → Secrets and variables → Actions**:

- **Secrets**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_CHAT_ID`, `REDIS_URL`, `AMAZON_AFFILIATE_TAG`, `MAGALU_STORE_NAME`
- **Variables**: `DEAL_DISCOUNT_THRESHOLD`, `ACTIVE_SOURCES`, `CATEGORY_KEYWORDS`

> **Importante:** sem o secret `REDIS_URL` configurado no GitHub Actions, o dedup fica **desativado** e as mesmas promoções são repostadas a cada execução. O worker emite um `AVISO` no log quando isso acontece.

Se uma secret não tiver valor real, **não a crie** — o GitHub não aceita salvar secret vazia, e um placeholder tipo `''` é lido como valor de verdade (ver `src/lib/env.ts`).

## Afiliados

- **Amazon**: anexa `?tag={AMAZON_AFFILIATE_TAG}` na URL do produto (formato oficial Associates).
- **Magazine Luiza**: troca o domínio para `magazinevoce.com.br/{MAGALU_STORE_NAME}`, mantendo o caminho do produto — é o formato do Magazine Você, que rastreia comissão.

O **Mercado Livre foi removido** por não ter sistema de afiliado automatizável (o link oficial usa um token assinado pelo servidor, não reproduzível sem violar os termos do programa).

## Limitações conhecidas

- Scraping de páginas de e-commerce é inerentemente frágil — mudanças no HTML dos sites podem quebrar os seletores e exigir manutenção.
