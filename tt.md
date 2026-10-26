# Mapa de flujos — api-access + bordes (pre-controllers)

Formato: `Trigger → paso1 → paso2 → ... → resultado`.
Marcas: **✅** implementado · **⚠️** parcial · **❌** falta.

---

## A. Happy paths

### Identity

| #       | Trigger                                     | Chain                                                                                                                                                                                                                                           | Produce                        |
| ------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **1.1** | `POST /users/register`                      | `User.register()` → `IAuthUser(active, roles=[client])` + `IUserProfile(kyc=pending, merchantApp=none)`                                                                                                                                         | identidad base ⚠️              |
| **1.2** | `POST /users/me/merchant-request`           | `IUserProfile.requestMerchantRole()` → `IMerchantRequest(pending)` + `IUserProfile.merchantApplicationStatus=pending`                                                                                                                           | solicitud ⚠️                   |
| **1.3** | `POST /admin/merchant-requests/:id/approve` | `ApproveMerchantUseCase`: `request.approve()` → `IMerchantProfile(active)` + `IUserProfile.link(merchantProfileId)` + `grantRole(merchant)` → **invoca `CreateApiClientUseCase`** → `ApiClient(active)` → `outbox(MerchantApproved)` → S4 async | merchant activo + ApiClient ⚠️ |
| **1.4** | `POST /auth/login`                          | `AuthUser.recordSuccessfulLogin()` → JWT                                                                                                                                                                                                        | sesión ❌                      |
| **1.5** | `POST /admin/merchant-requests/:id/reject`  | `request.reject()` → `IUserProfile.merchantApplicationStatus=rejected`                                                                                                                                                                          | solicitud resuelta ❌          |
| **1.6** | `DELETE /users/me/merchant-request/:id`     | `request.cancel()` (solo si pending)                                                                                                                                                                                                            | solicitud cancelada ❌         |

### Api-access

| #       | Trigger                            | Chain                                                                                                                                                                                                       | Produce                                              |
| ------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **2.1** | (interno, invocado por 1.3)        | `CreateApiClientUseCase`: `findByMerchantId` (idempotente) → `merchant.isActive()` → `ApiClient.create()` → `save`                                                                                          | `ApiClient(active)` ✅                               |
| **2.2** | `POST /api-credentials {env:test}` | `IssueApiCredentialUseCase`: `merchant.isActive()` → `apiClient.findByMerchantId` (debe existir) → `findActiveByApiClientAndEnv` (ninguna) → `ApiCredential.issue()` → `save`                               | `ApiCredential(active,test)` + `rawKey` ⚠️           |
| **2.3** | `POST /api-credentials {env:live}` | Igual que 2.2 + `owner.kycStatus === approved`                                                                                                                                                              | `ApiCredential(active,live)` + `rawKey` ⚠️           |
| **2.4** | `POST /v1/* (con Bearer)`          | `ApiKeyGuard` → `AuthenticateApiKeyUseCase`: `extractBearer` → `findByPrefix` → `verify(timingSafe)` → `credential.isActive()` → `apiClient.isActive()` → `merchant.isActive()` → `touch()` → `req.apiAuth` | `ApiAuthContext{credential, apiClient, merchant}` ✅ |
| **2.5** | `DELETE /api-credentials/:id`      | `RevokeApiKeyUseCase`: `findById` → `apiClient.find` → `assertActor` → `isActive` (idempotente) → `credential.revoke(reason)` → `save`                                                                      | `ApiCredential(revoked)` ✅                          |

### Payments

| #       | Trigger                                  | Chain                                                                                                                                                                                                                                                                                                  | Produce                                              |
| ------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| **3.1** | `POST /v1/payments` (ApiKeyGuard)        | `CreatePaymentLinkUseCase`: auth context → `merchantLedgerAccountId != null` → `findByExternalId` (idempotencia) → `Payment.create()` → `attachCheckoutToken(raw)` → `save`                                                                                                                            | `Payment(pending)` + `checkoutUrl` ⚠️                |
| **3.2** | `POST /v1/checkout/:token/pay` (session) | `ProcessPaymentUseCase`: `findByCheckoutTokenHash` → `canBeProcessed()` → `tryClaimForProcessing` → `buyer.isActive()` → `assignBuyer` → `startProcessing` → `save` → `LedgerPort.requestTransfer` → `SUCCEEDED` → `markAsSucceeded(ledgerTxId)` + `publishPaymentEvent(payment.succeeded)` (misma tx) | `Payment(succeeded)` + `WebhookDelivery(pending)` ⚠️ |
| **3.3** | (mismo trigger que 3.2)                  | … → Ledger `REJECTED` → `markAsFailed(errorCode)` + `publishPaymentEvent(payment.failed)`                                                                                                                                                                                                              | `Payment(failed)` ⚠️                                 |
| **3.4** | (mismo trigger que 3.2)                  | … → Ledger `UNKNOWN` → `markAsReconciliationRequired()` → `save`                                                                                                                                                                                                                                       | `Payment(reconciliation_required)` ⚠️                |

### Notifications

| #       | Trigger                                    | Chain                                                                                                                                                                                  | Produce                                                        |
| ------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **4.1** | `POST /webhooks`                           | `CreateWebhookEndpointUseCase`: `apiClient.isActive` → `assertActor` → `countByApiClientId < 10` → `findByApiClientAndUrl` (dup) → `WebhookEndpoint.create(secret generated)` → `save` | `WebhookEndpoint(active)` + `rawSecret` ✅                     |
| **4.2** | (interno, dentro de 3.2/3.3)               | `WebhookPublisher.publish(event)`: `findActiveByApiClientAndEvent` → envelope UNA vez → `WebhookDelivery.create()` × N → `saveMany`                                                    | N `WebhookDelivery(pending)` ✅                                |
| **4.3** | worker `@Interval(5s)`                     | `DeliverWebhookUseCase.deliverOne`: `tryClaim` (atómico) → `endpoint.find` + `isActive` → `sign(hmac)` → `POST` → 2xx → `markDelivered(2xx)`                                           | `WebhookDelivery(delivered)` ✅                                |
| **4.4** | (mismo trigger que 4.3, falla transitoria) | … → 5xx/408/429/network → `markAttemptFailed(retryable:true)` → backoff (30s, 2m, 10m, 1h, 6h) → vuelve a pending → **reintenta hasta 5 veces**                                        | `WebhookDelivery(pending                                       | failed)` ✅ |
| **4.5** | `PATCH /webhooks/:id`                      | `UpdateWebhookEndpointUseCase`: `assertActor` → validar `status↔reason` → aplicar URL/events/status (solo si cambia) → `save` (solo si `changed`)                                      | `WebhookEndpoint(updated)` ✅                                  |
| **4.6** | `GET /webhooks`                            | `ListWebhookEndpointsUseCase`: `assertActor` → paginación saneada → `list`+`count` paralelo → summary sin secret + `secretSuffix`                                                      | `WebhookEndpointSummary[]` ✅                                  |
| **4.7** | `POST /webhooks/:id/rotate-secret`         | `RotateWebhookSecretUseCase`: `assertActor` → `countPendingForEndpoint` → `rotateSecret(newSecret)` → `save`                                                                           | `rawSecret` + `pendingDeliveriesCount` ✅                      |
| **4.8** | `DELETE /webhooks/:id`                     | `DeleteWebhookEndpointUseCase`: `assertActor` → idempotencia → `runInTransaction(softDelete + cancelPendingForEndpoint)`                                                               | `WebhookEndpoint(deleted)` + N `WebhookDelivery(cancelled)` ✅ |

### Cross-module cascades (Etapa 2 — ❌ todas)

| #       | Trigger                      | Chain                                                                                                                                                                                                                                |
| ------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **5.1** | `Admin.suspendMerchant()`    | `merchant.suspend` → event `merchant.suspended` → `api-access` listener: `apiClient.suspend("merchant_suspended")` + `credentials.revoke("merchant_suspended")` → `notifications` listener: `endpoint.disable("merchant_suspended")` |
| **5.2** | `Admin.reactivateMerchant()` | reverse de 5.1 (reactivar client, dejar keys revoked para forzar re-emisión, habilitar endpoints)                                                                                                                                    |
| **5.3** | `Admin.banUser()`            | `authUser.ban` → event `user.banned` → cascada igual a 5.1                                                                                                                                                                           |

---

## B. Alternatives / branches por happy path

### 1.x Identity

- **1.1** — `email_ya_existe` → 409 · `password_débil` → 400
- **1.2** — `merchantApplicationStatus=pending|approved` → 409 · `kycStatus≠approved` → 409 (regla: solo KYC ok puede solicitar) · `roles` ya incluye merchant → 409
- **1.3** — `request.status≠pending` → 409 · `createApiClient` falla → rollback toda la tx · `merchant.technicalEmail` falta → `CreateApiClientError("technical_email_required")` · S4 no provisiona `ledgerAccountId` → `merchant` queda activo con `ledgerAccountId=null`, `CreatePaymentLinkUseCase` fallará al cobrar (`merchant_ledger_account_missing`)
- **1.5** — `request.status≠pending` → 409
- **1.6** — `request.status≠pending` → 409

### 2.x Api-access

- **2.2/2.3** — `merchant_not_found`/`merchant_not_active` → 404/409 · `api_client_not_found` → 409 (≠ auto-crear) · `api_client_suspended` → 409 · **ya existe active en mismo env** → 409 · `kyc_required` (live) → 409 · rawKey se pierde → revocar + emitir otra
- **2.4** — `missing_token` → 401 · `invalid_token` (formato/prefix/hash) → 401 · `revoked_token` → 401 · `client_suspended` → 401 · `merchant_inactive` → 401 · respuesta del cliente siempre 401 genérico (code queda en logs)
- **2.5** — `credential_not_found`/`client_not_found` → 404/500 · `forbidden` (merchant≠owner) → 403 · **ya revoked** → 200 `wasAlreadyRevoked:true` · **falta check `environment vs actor`** (deuda: un merchant con keys test no debería revocar live de otro)

### 3.x Payments

- **3.1** — `merchant_ledger_account_missing` → 400 · `findByExternalId` con **mismo payload** → 200 (idempotente, devuelve el existente) · **payload distinto** → 409 · `amount≤0` → 400 · `currency` no soportada → 400
- **3.2/3.3/3.4** — `payment_not_found` (token hash) → 404 · `canBeProcessed()` false (expirado/estado final) → 400 · `tryClaimForProcessing` false (race, doble clic) → 409 · `buyer_inactive` → 401 · `merchant_not_found` → 404 · **ledger timeout de transporte** → `markAsReconciliationRequired("LEDGER_TIMEOUT")`, **NO failed** · **crash después de Ledger SUCCEEDED sin guardar** → al reintentar con misma `idempotencyKey` Ledger devuelve mismo `ledgerTransactionId` → recuperable
- **3.5** ❌ (falta use case) — cron → `Payment(pending, now>expiresAt)` → `markAsExpired()` → `WebhookEvent(payment.expired)`
- **3.6** ❌ (falta use case) — admin/worker → `Payment(reconciliation_required)` → consultar Ledger con `idempotencyKey` → `markAsSucceeded(txId)` o `markAsFailed(reason)`

### 4.x Notifications

- **4.1** — `apiClient_not_found|not_active` → 403 · `forbidden` (actor≠owner) → 403 · `limit_exceeded (10)` → 409 · `duplicate_url` → 409 · `invalid_url` (no https, localhost) → 400 · `events.length=0` → 400
- **4.2** — **0 endpoints suscritos** → no-op (no es error) · `apiClient` sin endpoints configurados → no-op
- **4.3/4.4** — `endpoint_not_found` (borrado hard) → `failed` terminal · `endpoint_disabled` → `failed` terminal · `endpoint deleted` (soft) → `cancel("endpoint_deleted")` · **4xx (≠408,429)** → `failed` terminal · **5xx/408/429/network** → retry · **maxAttempts alcanzado** → `failed` terminal · **endpoint rota secret entre claim y firma** → delivery firmada con nuevo secret, cliente rechaza si no actualizó
- **4.5** — `not_found` → 404 · `forbidden` → 403 · `status:disabled` sin `disableReason` → 400 · `duplicate_url` (en otro endpoint) → 409 · **nada cambió** → 200 `changed:false` · **secret no se toca acá** (solo rotate)
- **4.6** — `apiClient_not_found` → 403 (no 404, no filtrar) · `forbidden` → 403 · `limit` fuera de [1,100] → clamp silencioso
- **4.7** — `not_found` → 404 · `forbidden` → 403 · **endpoint deleted** → 400 (`assertNotDeleted`) · **pending deliveries en vuelo** → advierte `pendingDeliveriesCount>0`
- **4.8** — `not_found` → 404 · `forbidden` → 403 · `reason` obligatorio → 400 · **ya deleted** → 200 `wasAlreadyDeleted:true` · **deliveries `delivering`** → no se cancelan (ya en vuelo)

### 5.x Cascadas (Etapa 2)

- **5.1** — `merchant.suspended` publicado → listeners pueden fallar → reintento outbox · `ApiClient.suspend` idempotente · `credential.revoke` idempotente
- **5.2** — `merchant.reactivated` → ApiClient reactivado, **keys siguen revoked** (fuerza re-emisión por seguridad), endpoints rehabilitados

---

## C. Grafo de dependencias entre flujos (quién bloquea a quién)

```
1.1 ──► 1.2 ──► 1.3 ──► [2.1 auto] ──► 2.2 ──► 2.4 ──► 3.1 ──► 3.2 ──► [4.2 auto] ──► 4.3
                          │              │
                          │              └──► 2.3 ──► 2.4 (live en prod)
                          │              └──► 2.5 (cierra)
                          │
                          ├──► 4.1 (endpoints, puede ir antes o después)
                          │
                          └──► [S4 async] ──► merchant.ledgerAccountId ──► 3.1 (guarda)
```

**Bloqueos reales**:

- 3.1 **requiere** `ledgerAccountId` de 1.3 (async). Sin él → `merchant_ledger_account_missing`.
- 2.4 **requiere** 2.2 o 2.3 (rawKey) + 2.1 (ApiClient) + merchant activo de 1.3.
- 3.2 **requiere** 3.1 (payment con token hash) + 2.4 (buyer session, no api-key).
- 4.3 **requiere** 4.2 (delivery creada) + 4.1 (endpoint existente).
- 1.3 **requiere** 1.2 aprobada.

---

## D. Estados terminales (ninguno vuelve atrás)

| Entidad            | Terminales                          | No-terminales                                      |
| ------------------ | ----------------------------------- | -------------------------------------------------- |
| `IAuthUser`        | `banned`                            | `active`, `suspended`, `pending_verification`      |
| `IMerchantRequest` | `approved`, `rejected`, `cancelled` | `pending`                                          |
| `IMerchantProfile` | `banned`                            | `active`, `suspended`, `pending_verification`      |
| `ApiClient`        | —                                   | `active`, `suspended` (reactivatable)              |
| `ApiCredential`    | `revoked`                           | `active`                                           |
| `Payment`          | `succeeded`, `failed`, `expired`    | `pending`, `processing`, `reconciliation_required` |
| `WebhookEndpoint`  | `deleted` (soft)                    | `active`, `disabled`                               |
| `WebhookDelivery`  | `delivered`, `failed`               | `pending`, `delivering`                            |

---

## E. Lo que falta antes de tocar controllers (checklist)

| #     |     | Gap                                                                                                                                                                                                                                                                                   | Bloquea         |
| ----- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **1** | ok  | `CreateApiClientUseCase`: eliminar `userProfileRepo` (muerto) + eliminar path `createdByRole: 'merchant'` (chicken-and-egg)                                                                                                                                                           | 1.3             |
| **2** | ok? | `IssueApiCredentialUseCase`: `findActiveByApiClientAndEnv` (no `findByApiClientId`) + eliminar `IUnitOfWork` vacío                                                                                                                                                                    | 2.2 / 2.3       |
| **3** |     | `CreatePaymentLinkUseCase`: recibir `apiClientId`+`apiKeyId`+`merchantId`+`merchantLedgerAccountId` del command (ya resueltos por el controller desde `req.apiAuth`); eliminar `merchantRepo`; `generateCheckoutToken` real; guard `ledgerAccountId != null`; idempotencia 200 vs 409 | 3.1             |
| **4** |     | `ProcessPaymentUseCase`: importar `IUnitOfWork`+`randomUUID`; guard `merchant.ledgerAccountId`; contrato `IWebhookPublisherPort` para `payment.failed`                                                                                                                                | 3.2 / 3.3 / 3.4 |
| **5** | ok  | `ApproveMerchantUseCase`: `createFromRequest` debe devolver `MerchantProfile` (hoy devuelve `MerchantRequest` por error de tipo en el repo)                                                                                                                                           | 1.3             |
| **6** | ok  | `IMerchantProfile.ledgerAccountId`: unificar a `?: string` (nullable) — hoy interfaz `string`, clase `string` no nullable                                                                                                                                                             | 3.1             |
| **7** |     | Contratos `IWebhookPublisherPort`: hoy solo `publishPaymentEvent(payment.succeeded)`. Agregar `payment.failed` / `payment.expired` o unificar en `publish(event)`                                                                                                                     | 3.3 / 3.5       |

**Los 4 críticos (P0)**: #1, #3, #4, #5. Con esos 4 el flujo 1.3 → 2.1 → 2.2 → 2.4 → 3.1 → 3.2 → 4.2 → 4.3 compila y corre end-to-end. El resto son gaps de Etapa 2 (cascadas) o Etapa 3 (KYC real, login).
