# Plano de Desenvolvimento — TEC2 Avaliação Final

Documento de planejamento para a refatoração do código legado de solicitações de viagem institucional.  
Baseado na análise do repositório, no enunciado oficial (`docs/tec2-aval.md`) e no mapeamento arquitetural já realizado.

> **Escopo deste documento:** planejamento apenas. Nenhuma linha de código deve ser alterada até seguir as etapas abaixo.

---

## 1. Contexto e objetivo

O projeto contém um código legado funcional, porém com débito técnico intencional em `src/original/`. A tarefa é:

1. **Preservar** o comportamento observável (testes em `tests/original/`).
2. **Refatorar** extraindo regras para `domain/`, orquestração para `application/` e persistência para `infra/`.
3. **Manter** `src/main.ts` como único contrato público.
4. **Entregar** testes próprios, persistência PostgreSQL, diagrama PDF e documentação.

### Restrições inegociáveis

| O que | Regra |
|---|---|
| `src/original/` | Não modificar, remover ou renomear |
| `tests/original/` | Não modificar, remover ou renomear |
| `src/main.ts` | Manter tipos e assinatura de `processTravelRequest` |
| Mensagens de erro/warning | Exatamente as strings em inglês definidas no enunciado |
| Commits | Mínimo 5, mensagens em inglês, incrementais e significativos |
| README | Nomes completos da equipe (nota zero se ausente) |

---

## 2. Estado atual do repositório

### 2.1 Estrutura existente

```text
src/
  main.ts                    → contrato público (hoje delega para original/)
  original/
    process-travel-request.ts
  domain/                    → vazio (.gitkeep)
  application/               → vazio (.gitkeep)
  infra/                     → vazio (.gitkeep)

tests/
  original/
    process-travel-request.test.ts   → 10 cenários de preservação
  domain/                    → vazio
  application/               → vazio
  infra/                     → vazio

database/
  init.sql                   → tabela travel_requests já definida

scripts/
  init-database.ts           → inicialização via DATABASE_URL
```

### 2.2 Contrato público (`src/main.ts`)

- Exporta tipos: `RequesterType`, `TravelRequestStatus`, `TravelRequestInput`, `TravelRequestOutput`.
- Exporta função: `processTravelRequest(input) → output`.
- Os testes importam **somente** de `src/main.ts`.

### 2.3 Fluxo atual vs. fluxo alvo

```text
ATUAL:
  main.ts → original/process-travel-request.ts

ALVO:
  main.ts → application/ → domain/
                         ↘ infra/ (persistência, quando aplicável)
```

---

## 3. Análise do código legado

Arquivo: `src/original/process-travel-request.ts`

Uma única função concentra **6 responsabilidades distintas**:

| # | Responsabilidade | Detalhe |
|---|---|---|
| 1 | Validação de campos obrigatórios | 6 campos: requestId, requesterName, requesterType, destination, departureDate, returnDate |
| 2 | Validação de datas | Formato `YYYY-MM-DD` + data real (ex.: rejeita `2026-02-30`) |
| 3 | Cálculo do período | Dias inclusivos entre departure e return |
| 4 | Cálculo financeiro | Diária por tipo, subtotal, total |
| 5 | Geração de warnings | Viagem > 5 dias + reason < 30 chars |
| 6 | Definição de status + montagem da resposta | rejected / pending-review / approved |

### 3.1 Regras de negócio (referência rápida)

**Diárias (em centavos):**

| requesterType | Valor |
|---|---|
| student | 9000 |
| employee | 18000 |
| professor | 25000 |
| manager | 30000 |

**Status:**

| Condição | status |
|---|---|
| Qualquer erro de validação | `rejected` |
| Sem erro + viagem > 5 dias | `pending-review` |
| Sem erro + total > 200000 centavos (R$ 2.000,00) | `pending-review` |
| Demais casos sem erro | `approved` |

**Cálculos:**

- `travelDays` = dias inclusivos (`floor((return - departure) / 86400000) + 1`)
- `subtotalInCents` = `travelDays * dailyAmountInCents`
- `totalAmountInCents` = `subtotalInCents + transportCostInCents`

**Mensagens fixas (não alterar):**

```text
requestId is required
requesterName is required
requesterType is required
destination is required
departureDate is required
returnDate is required
departureDate must be a valid YYYY-MM-DD date
returnDate must be a valid YYYY-MM-DD date
returnDate cannot be before departureDate
long travel requests should include a detailed reason
```

### 3.2 Funções auxiliares legadas a extrair

- `isBadDate(value)` → validação de formato e existência da data
- `dayNumber(value)` → conversão para timestamp UTC (cálculo de dias)

---

## 4. Arquitetura alvo

### 4.1 Princípios

- **Domain** não depende de `application`, `infra`, `pg`, Docker ou `process.env`.
- **Application** depende de domain; coordena o fluxo; pode definir portas (interfaces) para infra.
- **Infra** implementa detalhes externos (PostgreSQL); depende de contratos definidos acima.
- **main.ts** é fino: tipos públicos + delegação ao caso de uso.

### 4.2 Componentes planejados

#### Domain (`src/domain/`)

| Arquivo | Responsabilidade única |
|---|---|
| `travel-date.ts` | `isValidDate(value)`, `toUtcTimestamp(value)`, `calculateInclusiveDays(departure, return)` |
| `travel-validator.ts` | Valida input completo; retorna `string[]` de erros na ordem do legado |
| `travel-pricing.ts` | `getDailyAmountInCents(requesterType)`, `calculateSubtotal(days, daily)`, `calculateTotal(subtotal, transport)` |
| `travel-status.ts` | `determineStatus(errors, travelDays, totalInCents)`, `buildWarnings(travelDays, reason)` |
| `travel-analysis.ts` | Agrega domain: recebe input válido parcial, retorna números + status + warnings (sem I/O) |

> **Nota:** `travel-analysis.ts` é o orquestrador **de domínio** (regras puras). Não confundir com o use case da application.

#### Application (`src/application/`)

| Arquivo | Responsabilidade única |
|---|---|
| `ports/travel-request-repository.ts` | Interface: `save(input, output): Promise<void>` e/ou `findById(id): Promise<...>` |
| `process-travel-request-use-case.ts` | Orquestra: validar → analisar → montar output → persistir (se repositório injetado) |

#### Infrastructure (`src/infra/`)

| Arquivo | Responsabilidade única |
|---|---|
| `database/pg-client.ts` | Factory/conexão usando `DATABASE_URL` |
| `repositories/postgres-travel-request-repository.ts` | Implementação SQL da interface de repositório |
| `repositories/in-memory-travel-request-repository.ts` | *(opcional)* Implementação para testes de application sem Docker |

#### Entry point (`src/main.ts`)

- Mantém todos os tipos públicos exportados.
- Instancia dependências (repositório Postgres) e delega ao use case.
- `processTravelRequest` continua síncrona do ponto de vista do chamador **ou** async internamente — **atenção:** os testes atuais chamam de forma síncrona. A função pública deve permanecer **síncrona** (`TravelRequestOutput` direto, não `Promise`). Persistência deve ser tratada de forma que não quebre o contrato (ex.: fire-and-forget com catch interno, ou persistência síncrona via client síncrono — preferir abordagem que não altere a assinatura).

### 4.3 Diagrama de dependências (alvo)

```text
┌─────────────────────────────────────────────────────────┐
│                      src/main.ts                        │
│              (tipos públicos + delegação)               │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              ProcessTravelRequestUseCase                │
│                    (application)                        │
└───────┬─────────────────────────────────────┬───────────┘
        │                                     │
        ▼                                     ▼
┌───────────────────┐              ┌──────────────────────┐
│  Domain modules   │              │ TravelRequestRepo  │
│ validator         │              │    (port/interface) │
│ pricing           │              └──────────┬───────────┘
│ status            │                         │
│ analysis          │                         ▼
│ travel-date       │              ┌──────────────────────┐
└───────────────────┘              │ PostgresTravelRequest│
                                   │     Repository       │
                                   │      (infra)         │
                                   └──────────┬───────────┘
                                              │
                                              ▼
                                   ┌──────────────────────┐
                                   │     PostgreSQL       │
                                   │   (travel_requests)  │
                                   └──────────────────────┘
```

Entregar versão final deste diagrama em `docs/dependency-diagram.pdf`.

### 4.4 Tabela PostgreSQL existente (`database/init.sql`)

A tabela `travel_requests` já está definida com:

- Dados de entrada: `id`, `requester_name`, `requester_type`, `destination`, `departure_date`, `return_date`, `reason`, `transport_cost_in_cents`
- Dados de análise: `status`, `travel_days`, `daily_amount_in_cents`, `subtotal_in_cents`, `total_amount_in_cents`
- Metadado: `created_at`

**Decisão de persistência:** salvar após cada chamada bem-sucedida de `processTravelRequest` (independente do status final — approved, pending-review ou rejected). `errors` e `warnings` não estão na tabela; documentar essa escolha no README.

---

## 5. Estrutura de arquivos final esperada

```text
src/
  main.ts
  original/                          (intocado)
  domain/
    travel-date.ts
    travel-validator.ts
    travel-pricing.ts
    travel-status.ts
    travel-analysis.ts
  application/
    ports/
      travel-request-repository.ts
    process-travel-request-use-case.ts
  infra/
    database/
      pg-client.ts
    repositories/
      postgres-travel-request-repository.ts

tests/
  original/                          (intocado)
  domain/
    travel-date.test.ts
    travel-validator.test.ts
    travel-pricing.test.ts
    travel-status.test.ts
    travel-analysis.test.ts
  application/
    process-travel-request-use-case.test.ts
  infra/
    postgres-travel-request-repository.test.ts

docs/
  tec2-aval.md                       (fornecido)
  dependency-diagram.pdf             (a criar)
  plano-desenvolvimento.md           (este arquivo)
```

Convenções obrigatórias: `camelCase` (código), `PascalCase` (tipos/classes), `kebab-case` (arquivos/pastas), identificadores em inglês.

---

## 6. Plano de implementação por fases

Cada fase termina com validação antes de avançar.

**Convenção de progresso:** ao concluir uma fase, adicionar `(já feito)` no título dela — por exemplo, `### Fase 1 — Domain: validação (já feito)`. Isso deixa claro para a dupla o que já foi entregue e o que falta.

| Fase | Commit correspondente |
|---|---|
| 0 — Baseline e análise | — (pré-requisito) |
| 0.5a — Repo próprio + baseline clonada | Commit 1 |
| 0.5b — Plano no repositório | Commit 2 |
| 1 — Domain: validação | Commit 3 |
| 2 — Domain: cálculos e status | Commit 4 |
| 3 — Application + integração | Commits 5 e 6 |
| 4 — Infraestrutura e persistência | Commit 7 |
| 5 — Testes próprios completos | Commit 8 |
| 6 — Documentação e entrega | Commit 9 |

### Fase 0 — Baseline e análise (já feito)

- [x] Mapear estrutura do projeto
- [x] Ler `main.ts` e entender contrato público
- [x] Analisar código legado e regras de negócio
- [x] Definir arquitetura e componentes
- [x] Elaborar este plano em `docs/plano-desenvolvimento.md`
- [x] Confirmar baseline: `npm run typecheck` e `npm run test:original` passando

### Fase 0.5a — Repo próprio + baseline clonada (já feito)

**Objetivo:** publicar no **seu** GitHub o projeto **exatamente como veio do clone**, sem nenhum arquivo seu ainda.

1. Criar repositório **público vazio** na sua conta GitHub (sem README inicial).
2. Trocar o `origin` do remoto do professor para o seu repo.
3. Fazer **Commit 1** só com o estado do clone (ver seção 7 — comandos em `7.1`).
4. `git push -u origin main`.

**Importante:** o `docs/plano-desenvolvimento.md` **não entra** neste commit — ele fica untracked/local até o Commit 2.

**Validação:** repo público no seu GitHub; histórico começa com o projeto-base; `npm run test:original` passa.

**Ao concluir:** `### Fase 0.5a — Repo próprio + baseline clonada (já feito)`. ✓

### Fase 0.5b — Plano no repositório (já feito)

**Objetivo:** primeiro commit de **trabalho da dupla** — alinhar antes de codar.

1. Commitar `docs/plano-desenvolvimento.md` como **Commit 2**.
2. `git push`.
3. Parceiro(a) clona/pull e lê o plano antes de implementar.

**Validação:** plano visível no histórico; baseline confirmada.

**Ao concluir:** `### Fase 0.5b — Plano no repositório (já feito)`. ✓

### Fase 1 — Domain: validação (já feito)

**Commit:** 3 — `refactor: extract travel date and input validation into domain`

**Objetivo:** extrair validações sem alterar comportamento.

1. Criar `travel-date.ts` com `isValidDate` (portar lógica de `isBadDate` invertida).
2. Criar `travel-validator.ts` replicando ordem e mensagens dos erros do legado.
3. Ainda **não** alterar `main.ts`.

**Validação:** testes próprios de domain passando; `test:original` ainda passa (legado ativo).

**Ao concluir:** `### Fase 1 — Domain: validação (já feito)`. ✓

### Fase 2 — Domain: cálculos e status (já feito)

**Commit:** 4 — `refactor: extract pricing, status and travel analysis rules`

**Objetivo:** extrair pricing, período, status e warnings.

1. Criar `travel-pricing.ts`.
2. Completar `travel-date.ts` com `calculateInclusiveDays`.
3. Criar `travel-status.ts`.
4. Criar `travel-analysis.ts` unindo as peças (espelhando fluxo do legado).

**Validação:** testes próprios cobrindo cenários dos testes originais; `test:original` ainda passa.

**Ao concluir:** `### Fase 2 — Domain: cálculos e status (já feito)`.

### Fase 3 — Application + integração (já feito)

**Commits:** 5 e 6 — use case + `main.ts`

**Objetivo:** substituir implementação usada por `main.ts`.

1. Criar `process-travel-request-use-case.ts`.
2. Alterar `main.ts` para delegar ao use case (sem persistência ainda).
3. Garantir saída idêntica byte a byte nos campos testados.

**Validação:** `npm run typecheck` + `npm run test:original` + `npm test` (novos testes).

**Ao concluir:** `### Fase 3 — Application + integração (já feito)`.

### Fase 4 — Infraestrutura e persistência (já feito)

**Commit:** 7 — `feat: add PostgreSQL travel request persistence`

**Objetivo:** salvar/recuperar solicitações no PostgreSQL.

1. Criar interface `TravelRequestRepository` em `application/ports/`.
2. Criar `pg-client.ts` e `postgres-travel-request-repository.ts`.
3. Injetar repositório no use case; persistir após processamento.
4. Documentar no README: `db:up`, `db:init`, `.env`.

**Validação:** teste manual ou automatizado de persistência; `test:original` continua passando.

**Ao concluir:** `### Fase 4 — Infraestrutura e persistência (já feito)`.

### Fase 5 — Testes próprios completos (já feito)

**Commit:** 8 — `test: expand unit tests for application and infrastructure`

**Objetivo:** cobertura relevante (peso 3,0 na Avaliação 1).

Cenários mínimos recomendados:

| Módulo | Cenários |
|---|---|
| `travel-validator` | campos vazios, datas inválidas, return < departure, ordem dos erros |
| `travel-pricing` | cada requesterType, subtotal, total |
| `travel-date` | mesmo dia (1 dia), período inclusivo |
| `travel-status` | rejected com erros, pending por dias, pending por valor, approved |
| `travel-status` | warning de reason curta |
| `process-travel-request-use-case` | fluxo completo integrado (com mock do repo) |
| `postgres-travel-request-repository` | save + find (com banco de teste ou transação) |

**Validação:** `npm test` passa integralmente.

**Ao concluir:** `### Fase 5 — Testes próprios completos (já feito)`.

### Fase 6 — Documentação e entrega (já feito)

**Commit:** 9 — `docs: update README and add dependency diagram`

1. Atualizar `README.md`:
   - Nomes completos da equipe
   - Setup, testes, typecheck, banco
   - Uso crítico de IA (ferramentas, o que aceitou/rejeitou, como validou)
   - Decisões técnicas
2. Criar `docs/dependency-diagram.pdf` coerente com o código.
3. Checklist final do enunciado (seção 19).

**Ao concluir:** `### Fase 6 — Documentação e entrega (já feito)`.

---

## 7. Plano de commits

Mínimo exigido: **5 commits significativos em inglês**.  
Plano recomendado: **9 commits** (baseline clonada → plano → código → docs).

### 7.1 Setup manual — publicar o clone no seu GitHub (antes do Commit 1)

**Pré-requisito:** `docs/plano-desenvolvimento.md` existe localmente mas **ainda não foi adicionado** ao Git.

```powershell
cd "c:\Users\USERNOTE067\Documents\UESPI\Eyder\20261-tec2-aval"

# 1. Confirmar que o plano NÃO está staged
git status
# plano-desenvolvimento.md deve aparecer como "Untracked"

# 2. (Opcional) validar baseline antes de publicar
npm run typecheck
npm run test:original

# 3. Criar repo vazio no GitHub (público, sem README) e copiar a URL

# 4. Apontar para SEU repositório (não o do professor)
git remote set-url origin https://github.com/SEU-USUARIO/NOME-DO-REPO.git
git remote -v

# 5. Commit 1 — só o projeto como clonou (histórico limpo, 1 commit)
#    Usar nome temporário: "main" já existe, --orphan main falha.
git checkout --orphan temp-main
git commit -m "chore: import assessment base repository"
git branch -D main
git branch -m main

# 6. Publicar
git push -u origin main
```

> **Por que `--orphan`?** O clone traz o histórico do professor. Com `--orphan`, o Commit 1 do **seu** repo fica sendo exatamente o snapshot do projeto-base — um commit “seco”, sem o plano nem código novo. O enunciado pede repo **próprio**; isso deixa o histórico da entrega começando da dupla.

> **Alternativa mais simples (sem orphan):** `git push -u origin main` sem commits novos — o repo fica com o histórico do professor. Funciona, mas o “Commit 1” no GitHub não será authorship de vocês.

---

### Commit 1 — `chore: import assessment base repository`

**Conteúdo:** projeto inteiro como veio do `git clone` do professor.  
**Não incluir:** `docs/plano-desenvolvimento.md`, `tec2-aval.pdf` da raiz (se existir).

**Critério de pronto:** push no repo público da dupla; testes originais passam.

**Ao concluir:** marcar Fase 0.5a como `(já feito)`.

---

### Commit 2 — `docs: add development plan`

**Arquivos:**
- `docs/plano-desenvolvimento.md`

**Objetivo:** primeiro commit de trabalho — parceiro(a) vê o plano antes de codar.

```powershell
git add docs/plano-desenvolvimento.md
git commit -m "docs: add development plan"
git push
```

**Critério de pronto:** plano no GitHub; dupla alinhada.

**Ao concluir:** marcar Fase 0.5b como `(já feito)`.

---

### Commit 3 — `refactor: extract travel date and input validation into domain`

**Arquivos:**
- `src/domain/travel-date.ts`
- `src/domain/travel-validator.ts`
- `tests/domain/travel-date.test.ts`
- `tests/domain/travel-validator.test.ts`

**Não alterar:** `main.ts`, `src/original/`.

**Critério de pronto:** novos testes passam; `npm run test:original` passa.

**Ao concluir:** marcar Fase 1 como `(já feito)`.

---

### Commit 4 — `refactor: extract pricing, status and travel analysis rules`

**Arquivos:**
- `src/domain/travel-pricing.ts`
- `src/domain/travel-status.ts`
- `src/domain/travel-analysis.ts`
- `tests/domain/travel-pricing.test.ts`
- `tests/domain/travel-status.test.ts`
- `tests/domain/travel-analysis.test.ts`

**Critério de pronto:** domain cobre todos os cenários dos testes originais via testes próprios.

**Ao concluir:** marcar Fase 2 como `(já feito)`.

---

### Commit 5 — `refactor: add process travel request use case`

**Arquivos:**
- `src/application/ports/travel-request-repository.ts` (interface vazia ou noop inicial)
- `src/application/process-travel-request-use-case.ts`
- `tests/application/process-travel-request-use-case.test.ts`

**Critério de pronto:** use case produz output idêntico ao legado nos cenários testados.

---

### Commit 6 — `refactor: wire main entry point to application layer`

**Arquivos:**
- `src/main.ts` (trocar export de `./original/` para application)

**Critério de pronto:** `npm run typecheck` + `npm run test:original` passam. Legado permanece em `original/` apenas como referência.

**Ao concluir:** marcar Fase 3 como `(já feito)`.

---

### Commit 7 — `feat: add PostgreSQL travel request persistence`

**Arquivos:**
- `src/infra/database/pg-client.ts`
- `src/infra/repositories/postgres-travel-request-repository.ts`
- Ajustes em `process-travel-request-use-case.ts` e `main.ts` para injetar repositório
- `tests/infra/postgres-travel-request-repository.test.ts`

**Critério de pronto:** registro salvo na tabela `travel_requests` após processamento; README parcial sobre banco.

**Ao concluir:** marcar Fase 4 como `(já feito)`.

---

### Commit 8 — `test: expand unit tests for application and infrastructure`

**Arquivos:**
- Refino/expansão dos testes em `tests/application/` e `tests/infra/`
- Casos de borda adicionais se necessário

**Critério de pronto:** `npm test` passa; cobertura relevante, não trivial.

**Ao concluir:** marcar Fase 5 como `(já feito)`.

---

### Commit 9 — `docs: update README and add dependency diagram`

**Arquivos:**
- `README.md` (nomes, setup, IA, decisões)
- `docs/dependency-diagram.pdf`

**Critério de pronto:** checklist de entrega (seção 19 do enunciado) 100% verificado.

**Ao concluir:** marcar Fase 6 como `(já feito)`.

---

### Mapa commit → critérios de avaliação

| Commit | Avaliação 1 | Avaliação 2 |
|---|---|---|
| 1 | — | Repo próprio, baseline publicada |
| 2 | — | Alinhamento da dupla, histórico incremental |
| 3–4 | Refatoração, qualidade, testes próprios | Separação arquitetural |
| 5–6 | Preservação de comportamento, organização | Separação arquitetural |
| 7 | Organização mínima | Persistência, arquitetura |
| 8 | Testes próprios | — |
| 9 | — | README, diagrama, commits |

---

## 8. Estratégia de testes

### 8.1 Testes de preservação (`tests/original/`)

- Rodar antes e depois de **cada** commit: `npm run test:original`
- Nunca importar módulos internos nesses testes.
- Se falhar após commit: reverter ou corrigir antes de prosseguir.

### 8.2 Testes próprios

- Espelhar estrutura de `src/` em `tests/`.
- Testar **comportamento**, não detalhes de implementação frágeis.
- Evitar dependência de data atual, rede ou ordem de execução.
- Para infra: usar banco real com Docker **ou** isolar com repositório in-memory nos testes de application.

### 8.3 Comandos de verificação (rodar sempre)

```bash
npm run typecheck
npm run test:original
npm test
```

Com banco (a partir do commit 7):

```bash
npm run db:up
npm run db:init
# executar testes de infra / fluxo completo
npm run db:down
```

---

## 9. Decisões técnicas a documentar no README

Registrar explicitamente (com justificativa curta):

1. **Assinatura síncrona de `processTravelRequest`** — como a persistência foi integrada sem quebrar o contrato.
2. **O que é persistido** — input + resultado da análise; por que errors/warnings ficam de fora da tabela.
3. **Injeção de dependência** — como o repositório é criado em `main.ts`.
4. **Ordem de validação de erros** — mantida igual ao legado para compatibilidade.
5. **Uso de IA** — Cursor/ChatGPT/etc.: planejamento, geração de código, revisão; o que foi validado manualmente com `npm test`.

---

## 10. Checklist de entrega final

Antes de enviar o link no SIGAA:

- [ ] Repositório público no GitHub (próprio, não o do professor)
- [ ] `README.md` com nomes completos da equipe
- [ ] `src/original/` intacto
- [ ] `tests/original/` intacto
- [ ] `src/main.ts` com contrato preservado
- [ ] Solução refatorada em `domain/`, `application/`, `infra/`
- [ ] Testes próprios em `tests/domain/`, `tests/application/`, `tests/infra/`
- [ ] `npm install`, `npm run typecheck`, `npm test` OK
- [ ] Persistência PostgreSQL funcional com `DATABASE_URL`
- [ ] `docs/dependency-diagram.pdf` coerente com o código
- [ ] ≥ 5 commits significativos em inglês
- [ ] Sem `.env`, `node_modules` ou credenciais versionadas
- [ ] Documentação de uso crítico de IA no README

---

## 11. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Alterar ordem ou texto dos erros | Copiar strings literalmente; testar com `test:original` |
| Domain acoplado ao PostgreSQL | Interface de repositório em `application/ports/` |
| `processTravelRequest` async quebra testes | Manter assinatura síncrona; documentar estratégia de persistência |
| Commits grandes demais | Um commit por fase; validar testes entre commits |
| Diagrama divergente do código | Gerar PDF após código finalizado (commit 9) |
| Nota zero por falta de nomes | Colocar nomes no README no commit 9 |
| Dupla desalinhada | Commit 2 com este plano; commit 1 só baseline |

---

## 12. Ordem de execução resumida

```text
0. Publicar clone no repo da dupla (commit 1)
1. Plano no repositório (commit 2)
2. Domain (validação)
3. Domain (cálculos + status + analysis)
4. Application (use case)
5. main.ts → application
6. Infra (PostgreSQL)
7. Testes próprios (refino)
8. README + diagrama PDF
```

**Regra de ouro:** `npm run test:original` deve passar a partir do **commit 6** em diante. Nos commits 3–5, o legado ainda está ativo em `main.ts`. Commits 1 e 2 não alteram código de produção.

---

*Documento gerado para orientar o desenvolvimento incremental. Atualizar este plano apenas se decisões arquiteturais mudarem durante a implementação.*
