# TEC2 — Análise, Testes e Refatoração de Código Legado

Refatoração de um código legado de **processamento de solicitações de viagem institucional**,
preservando o comportamento observável e reorganizando a solução em camadas
(domínio, aplicação e infraestrutura), com persistência em PostgreSQL.

O enunciado oficial está em [`docs/tec2-aval.md`](docs/tec2-aval.md). Este README é um guia
operacional e de decisões técnicas — não substitui o enunciado.

## Equipe

- **Matheus Araújo Carvalho**
- **Francisco da Chagas Correia Neto**

## Requisitos

- Node.js 22
- npm
- Docker (apenas para a persistência PostgreSQL)

## Instalação

```bash
npm install
```

## Verificação (typecheck e testes)

```bash
npm run typecheck     # TypeScript em modo estrito, sem emitir
npm test              # todos os testes (Vitest)
npm run test:original # apenas os testes de preservação de comportamento
```

Os testes de infraestrutura (`tests/infra/`) exigem um banco disponível. Sem a variável
`DATABASE_URL` definida, eles são **automaticamente pulados** (`skipped`), de modo que
`npm test` executa com sucesso mesmo sem Docker.

## Banco de dados (PostgreSQL)

A infraestrutura de banco é fornecida via Docker Compose. A conexão é feita pela variável
de ambiente `DATABASE_URL`.

```bash
cp .env.example .env      # opcional: mantém a URL no ambiente local
npm run db:up             # sobe o PostgreSQL (docker compose)
npm run db:init           # cria a tabela travel_requests (database/init.sql)
npm run db:down           # derruba o banco e remove o volume
```

Para executar também os testes de infraestrutura contra o banco real, exporte a URL antes
de rodar os testes:

```bash
# bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/travel_requests"
npm test

# PowerShell
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/travel_requests"
npm test
```

Com `DATABASE_URL` definida, cada chamada de `processTravelRequest` também persiste a
solicitação processada na tabela `travel_requests`.

## Arquitetura

```text
src/
  main.ts                    # contrato público + composição das dependências
  original/                  # código legado (preservado, intocado)
  domain/                    # regras de negócio puras (sem I/O)
    travel-date.ts           #   validação/aritmética de datas
    travel-validator.ts      #   validação de campos e ordem dos erros
    travel-pricing.ts        #   diárias, subtotal e total
    travel-status.ts         #   status e advertências
    travel-analysis.ts       #   orquestrador de domínio (agrega as regras)
  application/
    ports/
      travel-request-repository.ts   # interface do repositório (porta)
    process-travel-request-use-case.ts # caso de uso
  infra/
    database/pg-client.ts            # criação do pool via DATABASE_URL
    repositories/
      postgres-travel-request-repository.ts # implementação SQL da porta
```

A direção das dependências aponta **para dentro**: a infraestrutura depende da porta
definida na aplicação (inversão de dependência) e o domínio não conhece aplicação, infra,
`pg`, Docker ou `process.env`. O diagrama completo está em
[`docs/dependency-diagram.pdf`](docs/dependency-diagram.pdf).

## Decisões técnicas

1. **Assinatura síncrona preservada.** `processTravelRequest(input): TravelRequestOutput`
   continua síncrona (contrato exigido pelos testes de preservação). A persistência é
   executada em *fire-and-forget* dentro do caso de uso: o resultado é retornado
   imediatamente e a gravação ocorre em segundo plano, com tratamento de erro isolado.
2. **O que é persistido.** Gravamos os dados de entrada mais o resultado da análise
   (`status`, `travelDays`, valores). Os campos `errors` e `warnings` **não** são
   persistidos, pois não existem colunas correspondentes na tabela `travel_requests`
   fornecida — são informações do contrato de saída, não do registro histórico.
3. **Persistência independente do status.** Toda solicitação processada é gravada
   (`approved`, `pending-review` ou `rejected`), como histórico da análise. Reprocessar o
   mesmo `requestId` atualiza o registro (`INSERT ... ON CONFLICT (id) DO UPDATE`).
4. **Injeção de dependência no `main.ts`.** O repositório PostgreSQL só é criado quando
   `DATABASE_URL` está definida; caso contrário, o caso de uso roda sem persistência. Isso
   mantém o contrato público testável sem exigir banco.
5. **Ordem de validação preservada.** As mensagens de erro e sua ordem são idênticas às do
   legado, garantindo compatibilidade com os testes de preservação.
6. **Legado intocado.** `src/original/` permanece como referência e não é mais chamado por
   `src/main.ts` após a refatoração.

## Uso crítico de Inteligência Artificial

- **Ferramenta utilizada:** Claude Code (Anthropic, modelo Claude Opus) como assistente de
  planejamento, geração de código e testes.
- **Como foi usada:** apoiou o mapeamento do legado, a proposta de arquitetura em camadas
  (documentada em [`docs/plano-desenvolvimento.md`](docs/plano-desenvolvimento.md)) e a
  escrita incremental de código e testes por fase.
- **Sugestões aceitas:** extração das regras para o domínio espelhando o legado; caso de uso
  como classe para permitir injeção do repositório; persistência *fire-and-forget* para não
  quebrar a assinatura síncrona; testes de infraestrutura com `skipIf` quando não há banco.
- **Sugestões rejeitadas/modificadas:** criar a interface do repositório antes de haver uso
  real foi adiado para não deixar uma camada decorativa (a porta só foi introduzida quando a
  persistência passou a consumi-la); a decisão de não persistir `errors`/`warnings` foi
  revisada manualmente contra o schema fornecido.
- **Como validamos:** toda sugestão foi verificada com `npm run typecheck` e `npm test`,
  exigindo que os testes de preservação (`tests/original/`) continuassem passando a cada
  etapa, e a persistência foi conferida executando os testes de infraestrutura com o banco
  ativo via Docker.

## Limitações conhecidas

- A persistência é *best-effort* (*fire-and-forget*): uma falha de gravação é registrada mas
  não interrompe o retorno da análise, por decisão de manter a assinatura síncrona.
- Os testes de infraestrutura dependem de um PostgreSQL acessível via `DATABASE_URL`; sem
  ele, são pulados.
