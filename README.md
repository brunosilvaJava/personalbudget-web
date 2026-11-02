# PersonalBudget Web

Front-end da [PersonalBudget API](https://github.com/brunosilvaJava/personalbudget): um PWA em React que roda no celular e no navegador e consome a API na rede de casa.

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

O CI (GitHub Actions) roda lint, formatação, tipos, testes e build em todo PR.

## Estrutura

```
src/
├─ app/          App, rotas, QueryClient, tema
├─ api/          contracts.ts (tipos da API), http.ts (fetch), um módulo por recurso
├─ features/     uma pasta por tela: página, formulários e queries.ts
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

## Fases

- [x] **Fase 0 · Fundação:** projeto, tema, client HTTP, contratos, proxy, navegação e CI
- [ ] **Fase 1 · Movimentações** (espera o back: PRs #58 a #66 mergeados)
- [ ] **Fase 2 · Dashboard e Caixa diário**
- [ ] **Fase 3 · Contas fixas e parceladas**
- [ ] **Fase 4 · Docker e PWA**, com HTTPS via Tailscale
- [ ] **Fase 5 · Multiusuário e visão do casal**
