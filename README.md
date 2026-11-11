# PersonalBudget Web

Front-end da [PersonalBudget API](https://github.com/brunosilvaJava/personalbudget): um PWA em React que roda no celular e no navegador e consome a API na rede de casa.

Telas: Início (dashboard), Movimentações, Carteira (contas, extrato, transferências, cartões, faturas, titulares e plásticos, terceiros e a receber), Recorrentes, Receita e calendário de feriados, Ciclos (com fechamento), Envelopes, Previsão de caixa e Caixa diário. Há ainda a importação de fatura de cartão a partir do CSV do Nubank ou do C6.

O plano completo, com as fases, está no doc "PersonalBudget — Plano do front-end" do projeto.

## Rodar

Requisitos: Node 22.22 ou mais novo, e a API rodando (por padrão em `http://localhost:8080`).

```bash
npm install
npm run dev
```

O Vite sobe na porta 5173 e já escuta na rede. No celular, na mesma rede, abra `http://<IP-do-PC>:5173`. A tela inicial mostra se a API está conectada.

O front chama sempre `/api/...` na própria origem, e o Vite repassa para a API sem o prefixo. Por isso o CORS do back não entra no caminho. Para apontar para outro endereço, copie `.env.example` para `.env.local` e mude `VITE_API_PROXY_TARGET`.

## Scripts

| Script                            | O que faz                                                     |
| --------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                     | Servidor de desenvolvimento com proxy `/api`                  |
| `npm run build`                   | Checagem de tipos e build de produção em `dist/`              |
| `npm run preview`                 | Serve o `dist/` na rede                                       |
| `npm run lint`                    | oxlint, incluindo a regra de camadas                          |
| `npm run format` / `format:check` | Prettier                                                      |
| `npm run typecheck`               | TypeScript `strict`                                           |
| `npm test` / `test:watch`         | Vitest com Testing Library e MSW, no fuso `America/Sao_Paulo` |
| `npm run e2e`                     | Playwright contra o app em `E2E_BASE_URL` (padrão `:3000`)    |
| `npm run check:contract`          | `contracts.ts` x OpenAPI do back (`openapi-typescript`)       |
| `npm run icons`                   | Gera os PNG do PWA a partir de `public/favicon.svg`           |

O CI (GitHub Actions) roda lint, formatação, tipos, testes e build em todo PR. Um segundo job sobe o back de verdade no Docker e roda o contrato e o Playwright (veja "Testes ponta a ponta").

## Estrutura

```
src/
├─ app/          App, rotas, QueryClient, tema
├─ api/          contracts.ts (tipos da API), http.ts (fetch), um módulo por recurso
├─ features/     uma pasta por tela: página, formulários e queries.ts
│                (ex.: wallet, third-parties, card-import, movements, cycles)
├─ components/   ui/ (shadcn), layout/ (AppShell, barras), domain/ (EmptyState...)
├─ lib/          format.ts, dates.ts, query-keys.ts, utils.ts
└─ test/         setup, servidor MSW, render do app
```

Regras que não se quebram:

- Tela e componente não importam `@/api/*`, só `@/api/contracts` (tipos). Os dados vêm dos hooks em `features/*/queries.ts`. O lint barra.
- Tipos da API só vêm de `src/api/contracts.ts`.
- Moeda e data são formatadas só em `src/lib/format.ts`. Datas da API são lidas com `parseApiDate`, nunca com `new Date('2026-11-10')`, que mostra o dia anterior em Brasília.

## Componentes shadcn/ui

O `components.json` já está configurado (estilo new-york, base neutral). Para adicionar um componente:

```bash
npx shadcn@latest add sheet
```

Os tokens de cor ficam em `src/index.css`: os do shadcn e três do domínio, `income`, `expense` e `warning`, com valores para o tema claro e o escuro. O tema segue o do sistema.

## Docker (dia a dia)

O front roda no nginx, na porta **3000**, e repassa `/api` para a API pelo nome do serviço, `personal_budget`. É o mesmo caminho do `npm run dev`: o navegador só fala com a própria origem, então o CORS do back não entra.

1. Suba o back pelo compose dele (`docker compose --profile app up -d` no repositório `personalbudget`).
2. Aqui: `docker compose up -d --build`. O celular abre `http://<IP-do-PC>:3000`.

O compose do front entra na rede do compose do back (`external`). O nome real da rede leva o prefixo do projeto do compose, e o padrão é `personalbudget_personalbudget-network`. Se o seu for outro (`docker network ls`), crie um `.env` ao lado do `docker-compose.yml`:

```
BACK_NETWORK=nome-da-rede
# opcionais
WEB_PORT=3000
API_UPSTREAM=http://personal_budget:8080
```

O nginx (`docker/nginx.conf`) resolve o endereço da API a cada requisição, então sobe mesmo com o back parado e acompanha o container quando ele é recriado. Ele também tira o cabeçalho `Origin` da chamada: o navegador o manda em POST/PATCH/DELETE mesmo na mesma origem, e atrás do proxy o Spring o tomaria por uma chamada de outro site (403 do filtro de CORS). O proxy do Vite faz o mesmo.

**IP fixo:** reserve o IP do PC no roteador (DHCP). Se ele mudar, o atalho do celular para de abrir.

## PWA e HTTPS (Tailscale)

O app tem manifest, ícones e service worker (`vite-plugin-pwa`). O service worker guarda só a casca do app, para abrir sem conexão. **Nada de `/api` é guardado**: o saldo mostrado vem sempre do servidor, e sem conexão o app avisa e não deixa gravar. Quando sai uma versão nova, o app mostra "Nova versão disponível" com o botão "Recarregar"; nunca troca de versão sozinho, para não perder um formulário aberto.

O service worker só funciona em HTTPS ou em `localhost`. Em `http://192.168...` o app abre e pode ir para a tela inicial como atalho, sem instalação completa nem cache offline. O caminho para o HTTPS, e para acessar fora de casa sem abrir porta no roteador, é o [Tailscale Serve](https://tailscale.com/kb/1312/serve):

1. Instale o Tailscale no PC e no celular e entre com a mesma conta.
2. No [console de administração](https://login.tailscale.com/admin/dns), ligue o **MagicDNS** e os **certificados HTTPS** (uma vez só).
3. Com o front no ar (porta 3000), no PC: `tailscale serve --bg 3000`.
4. `tailscale serve status` mostra o endereço, `https://<nome-do-pc>.<tailnet>.ts.net`. Para desfazer: `tailscale serve reset`.
5. No celular, com o Tailscale conectado, abra o endereço. No Android (Chrome): menu → **Instalar app**. No iPhone (Safari): **Compartilhar** → **Adicionar à Tela de Início**.

Só aparelhos da sua tailnet acessam, e isso faz o papel de controle de acesso enquanto a API não tem login. O PC precisa estar ligado e o celular com o app do Tailscale conectado. O plano Personal é gratuito, com até 6 usuários, e a Márcia entra pelo convite no console.

Os ícones (`public/icons/*`, `public/apple-touch-icon.png`) saem de `public/favicon.svg` com `npm run icons`; os PNG estão no repositório.

## Testes ponta a ponta

O Playwright roda os cenários contra o app servido como no dia a dia (nginx na porta 3000) com a **API real** atrás, em viewport de celular (Pixel 7) e de desktop:

- criar titular e plástico num cartão e comprar com o plástico;
- cartão emprestado a um terceiro: a compra vira "a receber", o recebimento credita a conta e a baixa fecha o recebível sem mexer em conta;
- importar um CSV de fatura do Nubank (prévia, pagamento deixado de fora) e reimportar o mesmo arquivo (tudo "já importada");
- lançar uma despesa já paga (criar + liquidar) e estornar, conferindo o saldo das contas na API;
- lançar uma despesa pendente, que não mexe no saldo;
- criar uma conta fixa com vencimento hoje e ver o lançamento gerado na hora, uma vez só;
- comprar no cartão, pagar a fatura e ver o saldo da conta baixar (e voltar ao estornar);
- os números do Início contra `GET /dashboard` e `GET /account/balance`;
- fechar um ciclo que já terminou pela tela (revisão com os números do back, snapshot), ver a movimentação do ciclo fechado travada e reabrir (só no celular: o ciclo passado só dá para criar uma vez por banco);
- manifest instalável, abrir sem conexão com o service worker e nenhum `/api` no cache.

No CI, o job `e2e` baixa o back (`master`), sobe MySQL e API com `docker compose --profile app` (banco vazio), sobe o front e roda tudo. Para rodar em casa:

```bash
# no repositório do back, com um banco que pode ser sujo
docker compose --profile app up -d --build
# aqui
docker compose up -d --build
npx playwright install chromium   # uma vez
npm run e2e
```

Todos os cenários que lançam movimentações abrem a lista com `?busca=<descrição>` (`findInList` em `e2e/helpers.ts`): o banco de teste é compartilhado e o mês passa de uma página (20) de movimentações, então a linha nova pode não estar na primeira.

**Atenção:** os cenários criam contas, cartões e lançamentos de verdade. Rode só contra um banco de teste, nunca contra o que você usa. O compose do back usa nomes fixos de container e as portas 3306 e 8080, então pare o back de uso diário antes e, no fim, `docker compose down` apaga o banco do teste. Se já tiver um Chrome, `CHROME_PATH=/usr/bin/google-chrome npm run e2e` dispensa o download.

## Contrato com o back

`src/api/contracts.ts` é a cópia do doc "Contrato da API (front)". Há duas conferências:

- **`npm run check:contract`** (roda no job `e2e` do CI) baixa o `/v3/api-docs` da API no ar, gera os tipos com `openapi-typescript` e deixa o `tsc` comparar cada interface do contrato com o schema de mesmo nome. Campo que existe só de um lado **falha**; tipo diferente só avisa. Interface que só existe de um lado é listada (por exemplo, os `Paged*` do back, ou um endpoint que o back ainda não mergeou). O `openapi-typescript` exige TypeScript 5 e o projeto usa o 7, então ele roda via `npx` com o TypeScript dele, fora do `package.json`.
- **`python3 scripts/check-contract.py ../personalbudget`** compara com os records de DTO do código do back (os dois repositórios lado a lado), sem precisar da API no ar.

## Fases

Uma PR por fase, empilhadas (cada uma sai da anterior).

- [x] **Fase 0 · Fundação:** projeto, tema, client HTTP, contratos, proxy, navegação e CI
- [x] **Fase 1a · Movimentações:** contrato novo, infraestrutura de formulários e lista com filtros
- [x] **Fase 1b · Ações nas movimentações:** lançar, editar, excluir, pagar e estornar
- [x] **Fase 2a · Carteira:** navegação nova, contas, extrato e transferências
- [x] **Fase 2b · Cartões:** cartões, compras, faturas e "Pagou com"
- [x] **Fase 3 · Dashboard e Caixa diário**
- [x] **Fase 4 · Recorrentes:** contas fixas e parceladas
- [x] **Fase 5 · Docker e PWA**, com HTTPS via Tailscale e testes ponta a ponta
- [x] **Fase 6 · Receita e calendário**
- [x] **Fase 7 · Ciclos**
- [x] **Fase 8 · Envelopes e previsão de caixa**
- [x] **Fase 8b · Fechamento de ciclo**
- [ ] **Cartões adicionais, terceiros e importação** (PRs empilhadas #18 a #24, ainda em rascunho; o back já está na `master`):
  - F0 contratos e API · F1 titulares e plásticos · F2 terceiros (padrão do cartão, selos, filtro "De quem", repasses) · F3 "A receber" e recebimentos · F4 baixa · F5 importação de fatura (CSV Nubank e C6)
- [ ] **Fase 9 · Multiusuário e visão do casal** (depende de login no back; adiada)

### Importar fatura

Em **Carteira → Cartão → Importar fatura**: escolha o CSV do Nubank (`date,title,amount`) ou do C6 (exportação da fatura, sem alterar o cabeçalho). O arquivo é lido no navegador; a prévia mostra uma linha por compra, com a fatura prevista, plástico, status (nova, já importada, parece repetida, erro) e uma caixa de seleção. Pagamentos de fatura e créditos ficam numa seção à parte e não são importados; tarifa com estorno do mesmo valor vem desmarcada. Plásticos que o cartão ainda não tem são cadastrados na própria tela antes de importar. Uma parcela k/N que cai em outra fatura mostra aviso e o botão "Tratar a data como a da parcela". São até 300 compras por importação, tudo ou nada; nada é lançado antes de você confirmar. Categorias ainda não são mapeadas.
