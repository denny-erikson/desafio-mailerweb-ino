# Backend

## Executar API

```bash
poetry install
poetry run alembic upgrade head
poetry run python -m scripts.seed_initial_user
poetry run uvicorn app.main:app --reload
```

## Executar worker

```bash
poetry run outbox-worker
```

Um unico ciclo:

```bash
poetry run outbox-worker --once
```

## Estrategia de Outbox + Worker

- eventos de reserva sao persistidos em `outbox_events`
- reserva e evento sao gravados na mesma transacao
- o worker busca pendencias em lote
- o worker pode enviar e-mails via `console` ou `smtp`
- no fluxo com Docker Compose, o SMTP local aponta para o MailHog
- sucesso marca `PROCESSED`
- falha atualiza `attempts`, `last_error`, `next_retry_at` e pode marcar `FAILED`
