# Meeting Room Booking

Aplicação full stack para gerenciamento de salas e reservas, com autenticação JWT, prevenção de conflito de horários e processamento assíncrono de notificações por e-mail com padrão Outbox + Worker.

## Visão geral

O projeto foi dividido em:

- `backend`: API em FastAPI com PostgreSQL, SQLAlchemy, Alembic e worker de outbox
- `frontend`: aplicação React com Vite
- `docker-compose.yml`: stack local com PostgreSQL, backend, worker, frontend e MailHog

## Stack

### Backend

- Python 3.12
- FastAPI
- SQLAlchemy 2
- Alembic
- PostgreSQL
- Poetry

### Frontend

- React 19
- Vite
- React Router
- Axios
- Vitest
- Testing Library

## Funcionalidades implementadas

- autenticação por JWT
- criação, listagem e visualização de salas
- criação, edição, listagem e cancelamento lógico de reservas
- participantes por reserva
- validações de data, duração e fuso horário
- bloqueio de conflito de horários por regra de negócio e por proteção no PostgreSQL
- criação de eventos no outbox na mesma transação da reserva
- worker separado com retry, persistência de erro e idempotência
- frontend consumindo a API real, com login, criação de salas e gestão de reservas
- testes de backend e frontend

## Como rodar com Docker

Esta é a forma recomendada para avaliação, porque sobe praticamente toda a estrutura com um único comando.

### 1. Preparar variáveis de ambiente

Crie o arquivo `.env` a partir do exemplo:

```bash
cp .env.example .env
```

### 2. Subir a stack principal

```bash
docker compose up -d --build
```

Isso sobe:

- `postgres`
- `backend`
- `worker`
- `frontend`
- `mailhog`

URLs úteis:

- frontend: `http://localhost:4173`
- backend: `http://localhost:8000`
- documentação da API: `http://localhost:8000/docs`
- MailHog: `http://localhost:8025`

Ao criar, editar ou cancelar uma reserva, o worker envia a notificação por SMTP para o MailHog. A validação pode ser feita abrindo a interface web e inspecionando a mensagem recebida.

### 3. Rodar o seed inicial manualmente

Se quiser garantir a criação do usuário inicial:

```bash
docker compose exec backend poetry run python -m scripts.seed_initial_user
```

### 4. Derrubar a stack

```bash
docker compose down
```

## Como rodar localmente sem Docker

### Backend

```bash
cd backend
poetry install
poetry run alembic upgrade head
poetry run python -m scripts.seed_initial_user
poetry run uvicorn app.main:app --reload
```

API:

- `http://localhost:8000`
- docs: `http://localhost:8000/docs`

### Worker

```bash
cd backend
poetry run outbox-worker
```

Executar apenas um ciclo:

```bash
cd backend
poetry run outbox-worker --once
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

URL:

- `http://localhost:5173`

## Variáveis de ambiente

As principais variáveis estão em `.env.example`.

### Aplicação

- `APP_NAME`
- `APP_ENV`
- `APP_DEBUG`
- `API_V1_PREFIX`
- `SECRET_KEY`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `ALGORITHM`

### Backend

- `BACKEND_HOST`
- `BACKEND_PORT`
- `BACKEND_CORS_ORIGINS`

### Banco de dados

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_SCHEMA`
- `DATABASE_URL`

### Worker

- `WORKER_POLL_INTERVAL_SECONDS`
- `WORKER_BATCH_SIZE`
- `OUTBOX_MAX_ATTEMPTS`
- `OUTBOX_RETRY_DELAY_SECONDS`

### Mailer

- `MAILER_FROM_EMAIL`
- `MAILER_PROVIDER`
- `MAILER_SMTP_HOST`
- `MAILER_SMTP_PORT`
- `MAILER_SMTP_USERNAME`
- `MAILER_SMTP_PASSWORD`
- `MAILER_SMTP_USE_TLS`
- `MAILER_SMTP_USE_SSL`
- `MAILER_SMTP_TIMEOUT_SECONDS`

### Seed inicial

- `INITIAL_USER_EMAIL`
- `INITIAL_USER_FULL_NAME`
- `INITIAL_USER_PASSWORD`

### Frontend

- `VITE_API_BASE_URL`

## Usuário inicial

O seed usa os valores do `.env`. No exemplo atual:

- e-mail: `admin@meetingroom.local`
- senha: `123@mudar`

## Estratégia de concorrência

O projeto protege conflito de reservas em dois níveis.

### Camada de aplicação

A API valida conflito usando a regra:

```text
new_start < existing_end AND new_end > existing_start
```

Com isso:

- reservas sobrepostas são bloqueadas
- reservas que apenas encostam no horário são permitidas

### Camada de banco

Além da validação da aplicação, o PostgreSQL usa uma constraint de exclusão com `EXCLUDE USING gist`, baseada em:

- `room_id`
- `tstzrange(start_at, end_at, '[)')`
- apenas reservas com status `ACTIVE`

Essa estratégia evita que duas requisições simultâneas criem reservas conflitantes para a mesma sala.

## Estratégia de Outbox + Worker

Ao criar, editar ou cancelar uma reserva:

1. a alteração da reserva é persistida
2. um evento é gravado em `outbox_events`
3. ambos são confirmados na mesma transação

Eventos implementados:

- `BOOKING_CREATED`
- `BOOKING_UPDATED`
- `BOOKING_CANCELED`

O worker:

- busca eventos pendentes em lote
- respeita `next_retry_at`
- evita disputa entre múltiplos workers com `FOR UPDATE SKIP LOCKED`
- processa os eventos
- marca `PROCESSED` em caso de sucesso
- incrementa `attempts` em caso de falha
- grava `last_error`
- agenda `next_retry_at`
- marca `FAILED` ao atingir o limite de tentativas
- evita reprocessamento de evento já concluído

## Decisões técnicas

- FastAPI foi escolhida pela rapidez de implementação, boa tipagem e integração simples com Pydantic
- PostgreSQL foi usado porque o desafio pede atenção especial à concorrência, e a constraint de exclusão resolve bem esse cenário
- o padrão Outbox + Worker foi mantido no próprio banco para reduzir complexidade operacional
- o provider de e-mail suporta `console` e `smtp`; para a experiência local em containers, o worker usa SMTP apontando para o MailHog
- o frontend foi organizado com rotas protegidas, contexto de autenticação e páginas separadas para salas e reservas
- a criação de salas também foi levada para a interface, o que reduz dependência de operações manuais no backend durante a avaliação
- o `docker compose` foi configurado para facilitar a avaliação com a stack completa em containers

## Testes

### Backend

Rodar:

```bash
cd backend
poetry run pytest -q
```

Coberturas principais:

- validação de datas
- conflito de reserva
- permissões
- criação de evento no outbox
- processamento do worker
- retry
- idempotência

### Frontend

Rodar:

```bash
cd frontend
npm test
```

Coberturas principais:

- login
- criação de salas
- criação de reserva
- bloqueio de horários no passado
- exibição do erro de conflito
- fluxo integrado do app com login, navegação protegida e criação de sala

## Como verificar o outbox e o worker

### Logs do worker

Se a stack estiver em Docker:

```bash
docker logs -f meeting-room-booking-worker
```

### Eventos no banco

```bash
docker exec -it meeting-room-booking-postgres psql -U postgres -d meeting_room_booking
```

Depois:

```sql
SELECT
  id,
  aggregate_type,
  aggregate_id,
  event_type,
  status,
  attempts,
  processed_at,
  next_retry_at,
  created_at
FROM outbox_events
ORDER BY id DESC;
```

## Observações finais

- o cancelamento de reserva é lógico, sem remoção física do registro
- a API bloqueia reservas com horário de início no passado
- o frontend também previne esse envio antes da chamada à API
- a interface do MailHog em `http://localhost:8025` permite validar visualmente as notificações geradas pelo worker
- a forma mais simples de avaliação é subir toda a stack com `docker compose up -d --build`
