# Servicio 3 — Own Payment Provider: flujos entrada / proceso / salida

```
═══════════════════════════════════════════════════════════════════════
                    SERVICIO 3 — FLUJOS COMPLETOS
═══════════════════════════════════════════════════════════════════════

   ENTRADA                     PROCESO                        SALIDA
═══════════════════════════════════════════════════════════════════════
```

---

## FLUJO 1 — Crear pago y enlace de checkout (Servicio 2 → Servicio 3)

```
┌─ ENTRADA ──────────────────────────────────────┐
│                                                │
│  POST /v1/payments                             │
│  Authorization: Bearer sk_live_...             │
│  Idempotency-Key: order-payment-123            │
│  Content-Type: application/json                │
│                                                │
│  {                                             │
│    "externalPaymentId": "payment_123",         │
│    "orderId": "order_456",                     │
│    "amount": 10000,                            │
│    "currency": "ARS",                          │
│    "description": "Compra de producto"         │
│  }                                             │
│                                                │
└───────────────────────┬────────────────────────┘
                        │
                        ▼
              ┌───────────────────────────┐
              │      PROCESO              │
              │                           │
              │ 1. ApiKeyGuard            │
              │    ├─ split Bearer        │
              │    ├─ SHA-256 hash        │
              │    ├─ findByPrefix        │
              │    ├─ timingSafeEqual     │
              │    └─ status ACTIVE       │
              │                           │
              │ 2. Idempotencia           │
              │    └─ findByExternalId    │
              │       ├─ SÍ → devolver    │
              │       │     el existente  │
              │       └─ NO → seguir      │
              │                           │
              │ 3. Resolver merchant      │
              │    └─ ApiClient           │
              │       → MerchantProfile   │
              │       → ledgerAccountId   │
              │                           │
              │ 4. Crear entidad          │
              │    ProviderPayment        │
              │    status = PENDING       │
              │    expiresAt = now+30m    │
              │                           │
              │ 5. attachCheckoutToken    │
              │    (rawToken aleatorio    │
              │     → hash SHA-256)       │
              │                           │
              │ 6. save()                 │
              │                           │
              └───────────┬───────────────┘
                          │
                          ▼
┌─ SALIDA ────────────────────────────────────────────────────────┐
│                                                                 │
│  201 Created                                                    │
│  {                                                              │
│    "providerPaymentId": "opp_789",                              │
│    "status": "PENDING",                                         │
│    "checkoutUrl": "https://pay.example.com/checkout/<token>",   │
│    "expiresAt": "2026-10-17T15:00:00Z"                          │
│  }                                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## FLUJO 2 — Checkout y pago con saldo (Comprador → Servicio 3 → Ledger)

```
┌─ ENTRADA ──────────────────────────────────────┐
│                                                │
│  POST /v1/checkout/{token}/pay                 │
│  Cookie: session=<buyerSession>                │
│                                                │
│  (el navegador NO envía importe, moneda,       │
│   cuenta destino — el server los resuelve)     │
│                                                │
└───────────────────────┬────────────────────────┘
                        │
                        ▼
              ┌───────────────────────┐
              │      PROCESO          │
              │                       │
              │ 1. Validar sesión     │
              │    └─ ProviderUser    │
              │       isActive()      │
              │                       │
              │ 2. Resolver pago      │
              │    findByCheckout     │
              │    TokenHash(token)   │
              │                       │
              │ 3. Entidad valida     │
              │    payment.           │
              │    canBeProcessed()?  │
              │    ├─ NO → 400        │
              │    └─ SÍ → seguir     │
              │                       │
              │ 4. startProcessing()  │
              │    status=PROCESSING  │
              │    save()             │
              │                       │
              │ 5. Construir comando  │
              │    TransferFundsCmd   │
              │    idempotencyKey =   │
              │    providerPaymentId  │
              │    debit = buyer.     │
              │      ledgerAccountId  │
              │    credit = merchant. │
              │      ledgerAccountId  │
              │                       │
              │ 6. ILedgerPort.       │
              │    requestTransfer()  │
              │           │           │
              │           ▼           │
              │    ┌──────────────┐   │
              │    │   LEDGER     │   │
              │    │  valida      │   │
              │    │  saldo/moneda│   │
              │    │  registra    │   │
              │    │  Transaction │   │
              │    │  + Entries   │   │
              │    └──────┬───────┘   │
              │           │           │
              │     ┌─────┴─────┐     │
              │     ▼           ▼     │
              │  success    error/timeout
              │     │           │     │
              │     │           │     │
              │     ▼           ▼     │
              │  markAs     markAs    │
              │  Succeeded  Failed    │
              │  (ledgerTxId) (reason)│
              │     │           │     │
              │     └─────┬─────┘     │
              │           │           │
              │           ▼           │
              │        save()         │
              │           │           │
              │           ▼           │
              │    ┌──────────────┐   │
              │    │  OUTBOX      │   │
              │    │  (misma tx BD│   │
              │    │   que save)   │   │
              │    └──────┬───────┘   │
              │           │           │
              └───────────┼───────────┘
                          │
                          ▼
┌─ SALIDA ───────────────────────────────────────┐
│                                                │
│  HTTP 200 al navegador                         │
│  { "status": "SUCCEEDED" }                     │
│                                                │
│  + Evento encolado en OUTBOX                   │
│    (lo consume el Flujo 3)                     │
│                                                │
│  ⚠️  El navegador NUNCA es fuente de verdad.   │
│     La redirección a "/success" es solo UX.    │
│                                                │
└────────────────────────────────────────────────┘
```

---

## FLUJO 3 — Webhook al Servicio 2 (asíncrono, con outbox)

```
┌─ ENTRADA ──────────────────────────────────────┐
│                                                │
│  Worker lee OUTBOX                             │
│  (eventos con status = PENDING)                │
│                                                │
│  {                                             │
│    "eventId": "evt_001",                       │
│    "type": "payment.succeeded",                │
│    "providerPaymentId": "opp_789",             │
│    "externalPaymentId": "payment_123",         │
│    "orderId": "order_456",                     │
│    "amountInCents": 10000,                     │
│    "currency": "ARS",                          │
│    "ledgerTransactionId": "txn_321"            │
│  }                                             │
│                                                │
└───────────────────────┬────────────────────────┘
                        │
                        ▼
              ┌───────────────────────┐
              │      PROCESO          │
              │                       │
              │ 1. Firmar payload     │
              │    HMAC-SHA256        │
              │    (secret del        │
              │     WebhookEndpoint)  │
              │                       │
              │ 2. POST al webhook    │
              │    del Servicio 2     │
              │    Header:            │
              │    X-Signature: ...   │
              │           │           │
              │           ▼           │
              │    ┌──────────────┐   │
              │    │  SERVICIO 2  │   │
              │    │  valida firma│   │
              │    │  deduplica   │   │
              │    │  eventId     │   │
              │    └──────┬───────┘   │
              │           │           │
              │     ┌─────┴─────┐     │
              │     ▼           ▼     │
              │   2xx        4xx/5xx  │
              │     │        timeout  │
              │     │           │     │
              │     ▼           ▼     │
              │  marca       reintento│
              │  DELIVERED   backoff  │
              │  (attempts)  exp.     │
              │              │        │
              │              ▼        │
              │         ┌──────────┐  │
              │         │  <<<     │  │
              │         │  vuelve  │  │
              │         │  a 1.    │  │
              │         └──────────┘  │
              │                       │
              └───────────┬───────────┘
                          │
                          ▼
┌─ SALIDA ───────────────────────────────────────┐
│                                                │
│  OUTBOX: status = DELIVERED                    │
│  (o FAILED tras N intentos → dead letter)      │
│                                                │
│  WebhookDelivery.attempts++, lastError,        │
│  nextRetryAt                                    │
│                                                │
│  Servicio 2 confirma al e-commerce             │
│                                                │
└────────────────────────────────────────────────┘
```

---

## MÁQUINA DE ESTADOS — `ProviderPayment`

```
                    ┌───────────┐
     create ──────▶│  PENDING  │
                    └─────┬─────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
       expiresAt    startProcessing  attachCheckout
       pasó         (checkout pay)   Token (al crear)
              │           │           │
              ▼           ▼           │
        ┌──────────┐ ┌───────────┐    │
        │ EXPIRED  │ │PROCESSING │◀──┘
        └──────────┘ └─────┬─────┘
                           │
                 ┌─────────┴─────────┐
                 ▼                   ▼
          ┌────────────┐      ┌────────────┐
          │ SUCCEEDED  │      │   FAILED   │
          │ (requiere  │      │ (reason)   │
          │ ledgerTxId)│      └────────────┘
          └────────────┘
                 │
                 │ ← terminal, no vuelve
                 │   a PENDING
                 ▼
              (fin)
```

Reglas protegidas por la entidad:

- `SUCCEEDED` **exige** `ledgerTransactionId` → `markAsSucceeded(id)`.
- `EXPIRED` solo si `now > expiresAt` → `markAsExpired()`.
- `SUCCEEDED` no vuelve a `PENDING`.
- No se puede procesar dos veces (`canBeProcessed()`).
- Importe y moneda **nunca** vienen del navegador.

---

## HAPPY PATH COMPLETO — vista de secuencia

```
Servicio 2        Servicio 3              Ledger         Comprador        E-commerce
    │                  │                     │                │                 │
    │ 1. POST /payments│                     │                │                 │
    │────────────────▶│                     │                │                 │
    │                  │ 2. PENDING + save   │                │                 │
    │ 3. checkoutUrl   │                     │                │                 │
    │◀────────────────│                     │                │                 │
    │                  │                     │                │                 │
    │                  │                     │     4. login   │                 │
    │                  │◀────────────────────────────────────│                 │
    │                  │                     │     5. pay     │                 │
    │                  │◀────────────────────────────────────│                 │
    │                  │ 6. PROCESSING       │                │                 │
    │                  │───────────────────▶│                │                 │
    │                  │                     │ 7. débito +    │                 │
    │                  │                     │    crédito     │                 │
    │                  │ 8. txnId            │                │                 │
    │                  │◀───────────────────│                │                 │
    │                  │ 9. SUCCEEDED +save  │                │                 │
    │                  │ 10. outbox event    │                │                 │
    │                  │                     │  11. 200 OK    │                 │
    │                  │────────────────────────────────────▶│                 │
    │                  │                     │                │                 │
    │ 12. webhook      │                     │                │                 │
    │◀────────────────│                     │                │                 │
    │ 13. confirma orden al e-commerce       │                │                 │
    │─────────────────────────────────────────────────────────────────────────▶│
    │                  │                     │                │                 │
```

---

## Resumen entrada → proceso → salida

| Flujo               | Entrada                                         | Proceso clave                                                                           | Salida                               |
| ------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------ |
| **1. Crear pago**   | `POST /v1/payments` + API key + Idempotency-Key | Guard → idempotencia → crear `ProviderPayment(PENDING)` → token → save                  | `201` con `checkoutUrl`              |
| **2. Checkout/pay** | `POST /v1/checkout/{token}/pay` + sesión        | Validar sesión → entidad valida → `PROCESSING` → Ledger → `SUCCEEDED`/`FAILED` → outbox | `200` al navegador + evento encolado |
| **3. Webhook**      | Worker lee OUTBOX                               | Firmar HMAC → POST Servicio 2 → retry con backoff                                       | `DELIVERED` o `FAILED` (dead letter) |

**Fuente de verdad:** el Ledger, no el navegador ni el `checkoutUrl`.
**Idempotencia:** `providerPaymentId` como idempotency key en el Ledger.
**Webhooks confiables:** outbox en la misma transacción que el cambio de estado.
