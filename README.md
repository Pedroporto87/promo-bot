# promo-bot

Worker que monitora promoções na Amazon e em redes de afiliados, filtra por desconto mínimo e categoria, e envia automaticamente pelo WhatsApp com link de afiliado.

## Como funciona

- `src/lib/scrapers/amazon.ts` — raspa a página de ofertas da Amazon via Playwright.
- `src/lib/scrapers/lomadee.ts` — consulta a API de afiliados da Lomadee (produtos + link rastreado).
- `src/lib/deals/detect.ts` — calcula o % de desconto e aplica o limite mínimo (`DEAL_DISCOUNT_THRESHOLD`).
- `src/lib/deals/category-filter.ts` — filtra por palavra-chave no título (`CATEGORY_KEYWORDS`).
- `src/lib/dedup.ts` — usa Redis (com TTL) pra não postar a mesma promoção repetidamente.
- `src/lib/whatsapp.ts` — seleciona o provedor de envio (`baileys` ou `meta`).
- `src/lib/whatsapp-baileys.ts` — envia pelo WhatsApp Business pareado para o piloto local.
- `src/lib/whatsapp-meta.ts` — mantém a integração oficial da Meta para uma migração futura.

## Rodando

Copie `.env.example` para `.env` e preencha as variáveis (veja abaixo).

```bash
npm install
npx playwright install chromium
npm run check   # roda uma checagem única e sai
npm start       # roda continuamente, checando a cada CHECK_INTERVAL_MINUTES
npm run whatsapp:pair # pareia o WhatsApp Business para uso com Baileys
npm run whatsapp:test # envia uma única mensagem segura ao primeiro destinatário
```

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `WHATSAPP_PROVIDER` | não (default `baileys`) | Provedor de envio: `baileys` para o piloto ou `meta` para a Cloud API |
| `BAILEYS_PHONE_NUMBER` | no pareamento | Número do WhatsApp Business com DDI e DDD, somente dígitos |
| `BAILEYS_AUTH_DIR` | não (default `.baileys-auth`) | Pasta local da sessão; nunca deve ser enviada ao Git |
| `BAILEYS_PAIRING_METHOD` | não (default `qr`) | Use `qr`; `code` fica disponível como alternativa experimental |
| `BAILEYS_SEND_DELAY_MS` | não (default `3000`) | Intervalo entre destinatários no piloto |
| `WHATSAPP_ACCESS_TOKEN` | somente Meta | Token de acesso permanente da WhatsApp Cloud API |
| `WHATSAPP_PHONE_NUMBER_ID` | somente Meta | ID do número remetente no painel da Meta |
| `WHATSAPP_RECIPIENTS` | sim | Números com opt-in, em formato internacional e separados por vírgula (ex.: `5511999999999`) |
| `WHATSAPP_TEMPLATE_NAME` | somente Meta | Nome do template de marketing aprovado pela Meta |
| `WHATSAPP_TEMPLATE_LANGUAGE` | não (default `pt_BR`) | Idioma exato em que o template foi aprovado |
| `WHATSAPP_API_VERSION` | não (default `v23.0`) | Versão da Graph API; pode ser atualizada por configuração |
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

- **Secrets**: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_RECIPIENTS`, `REDIS_URL`, `AMAZON_AFFILIATE_TAG`, `LOMADEE_API_KEY`
- **Variables**: `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANGUAGE`, `WHATSAPP_API_VERSION`, `DEAL_DISCOUNT_THRESHOLD`, `ACTIVE_SOURCES`, `CATEGORY_KEYWORDS`, `LOMADEE_ORGANIZATION_IDS`

> **Importante:** sem o secret `REDIS_URL` configurado no GitHub Actions, o dedup fica **desativado** e as mesmas promoções são repostadas a cada execução. O worker emite um `AVISO` no log quando isso acontece.

Se uma secret não tiver valor real, **não a crie** — o GitHub não aceita salvar secret vazia, e um placeholder tipo `''` é lido como valor de verdade (ver `src/lib/env.ts`).

## Piloto local com Baileys

1. Instale e ative o WhatsApp Business no telefone com o número exclusivo.
2. Configure `WHATSAPP_PROVIDER=baileys`, `BAILEYS_PHONE_NUMBER` e um único número de teste em `WHATSAPP_RECIPIENTS`.
3. Execute `npm run whatsapp:pair`.
4. No celular, acesse **Configurações → Aparelhos conectados → Conectar aparelho** e leia o QR Code exibido no terminal.
5. Depois da confirmação, a sessão fica em `.baileys-auth`. Essa pasta equivale a um aparelho autenticado e deve permanecer privada.
6. Execute `npm run whatsapp:test`; ele envia uma única mensagem fixa ao primeiro destinatário.
7. Somente depois desse teste, execute `npm run check` para buscar e enviar promoções reais.

O Baileys não é uma API oficial do WhatsApp. Há risco de desconexão ou restrição do número; use apenas contatos com consentimento, volume baixo e intervalos entre mensagens. O modo Baileys não deve ser executado no GitHub Actions porque a máquina temporária não preserva a sessão.

## Configurando a Meta Cloud API

1. No Meta for Developers, crie um app do tipo Business, adicione o produto WhatsApp e vincule um portfólio empresarial e um número remetente.
2. Gere um token permanente para um usuário do sistema com permissão de envio e copie também o **Phone Number ID**.
3. No WhatsApp Manager, crie e envie para aprovação um template de categoria **Marketing**, idioma `pt_BR`, nome `promocao_afiliado` (ou ajuste `WHATSAPP_TEMPLATE_NAME`).
4. Use este corpo, mantendo exatamente a ordem das seis variáveis esperada pelo código:

```text
🔥 {{1}}% OFF — {{2}}
{{3}}
De: {{4}}
Por: {{5}}
Confira: {{6}}
```

As variáveis representam desconto, loja, título, preço anterior, preço atual e link. Cadastre em `WHATSAPP_RECIPIENTS` apenas pessoas que deram consentimento para receber promoções. A Cloud API envia mensagens individuais; ela não publica em grupos do WhatsApp. Para listas maiores, o ideal é manter os contatos e seus opt-ins em um banco, em vez de uma variável de ambiente.

## Afiliados

- **Amazon**: anexa `?tag={AMAZON_AFFILIATE_TAG}` na URL do produto (formato oficial Associates).
- **Lomadee**: usa a API oficial (`api.lomadee.com.br`, header `x-api-key`). Os produtos vêm do endpoint `/affiliate/products`; o link rastreado é gerado em `/affiliate/shortener/url`. **Requer um canal cadastrado no painel da Lomadee** — sem canal, a API não devolve link e o worker posta sem comissão (com aviso no log).

O **Mercado Livre** foi removido (sem afiliado automatizável) e a **Magazine Luiza** também (a página de ofertas bloqueia scraping com 403/Cloudflare, e a Magalu não é anunciante da conta Lomadee — é o programa Magazine Você, separado).

## Limitações conhecidas

- Scraping de páginas de e-commerce é inerentemente frágil — mudanças no HTML dos sites podem quebrar os seletores e exigir manutenção.
- A chave Lomadee `lmd_dev_` é sandbox (dados de teste, sem canais). Comissão real exige chave `lmd_prod_` + canal cadastrado.
