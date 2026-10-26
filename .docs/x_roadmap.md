# Entidades del dominio de negocio (sin ledger)

Asumo que ya tenés `ApiClient`, `ApiKey`, `Payment`, `WebhookEndpoint`, `WebhookDelivery` y `RequestLog`.
Acá va **todo lo demás**, agrupado por feature y marcado cuándo sumarlo.

## Value objects base (compartidos)

```ts
type EntityId = string;
type Money = { amount: number; currency: string }; // amount en unidades mínimas (centavos)
```

---

## 1. Refunds (devoluciones) — día 2

```ts
class Refund {
  id: EntityId;
  paymentId: EntityId; // FK → Payment
  clientId: EntityId; // denormalizado para queries
  amount: Money; // parcial o total
  reason: "duplicate" | "fraudulent" | "requested_by_customer" | "other";
  status: "pending" | "approved" | "rejected" | "failed";
  providerRefundId?: string; // id en el PSP real
  failureReason?: string;
  createdAt: Date;
  completedAt?: Date;
}
```

**Regla**: 1 `Payment` → N `Refund`, pero la suma de `approved` no puede superar el `amount` del pago.

---

## 2. Disputes / Chargebacks — día 2/3

```ts
class Dispute {
  id: EntityId;
  paymentId: EntityId;
  clientId: EntityId;
  amount: Money;
  reason: string; // 'fraud', 'product_not_received', etc.
  status: "needs_response" | "under_review" | "won" | "lost" | "closed";
  evidenceDueBy?: Date;
  providerDisputeId?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

class DisputeEvidence {
  id: EntityId;
  disputeId: EntityId;
  type: "text" | "file" | "url";
  content: string; // texto o URL del archivo
  submittedAt?: Date;
  createdAt: Date;
}
```

**Nota**: el `status` de `Payment` debería reflejar el dispute (`disputed`), pero no dupliques la máquina de estados — la fuente de verdad es `Dispute`.

---

## 3. Customers (pagadores finales del comercio) — día 2

```ts
class Customer {
  id: EntityId;
  clientId: EntityId; // el comercio dueño de este customer
  email: string;
  name?: string;
  externalReference?: string; // el id del customer en el sistema del comercio
  metadata: json;
  createdAt: Date;
}
```

**Ojo**: no confundir con `ApiClient`. `ApiClient` = el comercio que te llama; `Customer` = el comprador de ese comercio.

---

## 4. Payment methods (tarjetas tokenizadas) — día 2

```ts
class PaymentMethod {
  id: EntityId;
  clientId: EntityId;
  customerId?: EntityId;
  type: "card" | "bank_transfer" | "cash" | "wallet";
  status: "active" | "expired" | "revoked";
  providerToken: string; // token del PSP; NUNCA guardes PAN/CVV
  card?: {
    brand: string; // 'visa' | 'master' | ...
    last4: string;
    expMonth: number;
    expYear: number;
    fingerprint: string; // para detectar duplicados
  };
  createdAt: Date;
}
```

---

## 5. Subscriptions / recurrencia — día 3+

```ts
class Plan {
  id: EntityId;
  clientId: EntityId;
  name: string;
  amount: Money;
  interval: "day" | "week" | "month" | "year";
  intervalCount: number;
  trialDays?: number;
  status: "active" | "archived";
  createdAt: Date;
}

class Subscription {
  id: EntityId;
  clientId: EntityId;
  customerId: EntityId;
  planId: EntityId;
  paymentMethodId: EntityId;
  status: "trialing" | "active" | "past_due" | "canceled" | "paused";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  createdAt: Date;
}

class SubscriptionInvoice {
  id: EntityId;
  subscriptionId: EntityId;
  clientId: EntityId;
  amount: Money;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  periodStart: Date;
  periodEnd: Date;
  paymentId?: EntityId; // el Payment que la saldó
  createdAt: Date;
  paidAt?: Date;
}
```

**Importante**: `SubscriptionInvoice` **no** es ledger — es el documento de facturación de la suscripción. El asiento contable va al ledger aparte.

---

## 6. Payouts / liquidaciones al comercio — día 3+

```ts
class Payout {
  id: EntityId;
  clientId: EntityId;
  amount: Money;
  status: "pending" | "in_transit" | "paid" | "failed" | "canceled";
  arrivalDate: Date;
  providerPayoutId?: string;
  failureReason?: string;
  createdAt: Date;
  paidAt?: Date;
}

class PayoutItem {
  id: EntityId;
  payoutId: EntityId;
  type: "payment" | "refund" | "fee_adjustment";
  paymentId?: EntityId;
  refundId?: EntityId;
  amount: Money; // puede ser negativo (refunds)
}
```

**Relación**: un `Payout` agrupa N `PayoutItem` que explican de dónde sale el neto. Esto _no_ es el ledger, es el detalle de una transferencia concreta.

---

## 7. Fees / pricing — día 3+

```ts
class FeeSchedule {
  id: EntityId;
  clientId: EntityId;
  name: string;
  // ej: { percentage: 2.9, fixed: 30, currency: 'USD', min: 0, max: null }
  rules: json;
  status: "active" | "archived";
  createdAt: Date;
}

class Fee {
  id: EntityId;
  clientId: EntityId;
  paymentId?: EntityId;
  refundId?: EntityId;
  type: "processing" | "platform" | "refund" | "dispute";
  amount: Money;
  createdAt: Date;
}
```

`Fee` es el **hecho** de cuánto cobraste; el asiento de ese fee va al ledger.

---

## 8. Idempotencia — día 1/2 (importante para una API de pagos)

```ts
class IdempotencyKey {
  id: EntityId;
  clientId: EntityId;
  apiKeyId: EntityId;
  key: string; // el header Idempotency-Key
  requestHash: string; // hash del body para detectar reuso con distinto payload
  responseStatus: number;
  responseBody: json;
  createdAt: Date;
  expiresAt: Date;
}
```

Unique `(clientId, key)`. Sin esto te van a duplicar pagos.

---

## 9. Eventos internos / transactional outbox — día 2

```ts
class OutboxEvent {
  id: EntityId;
  clientId: EntityId;
  type: string; // 'payment.approved', 'refund.created', ...
  payload: json; // snapshot del recurso al momento del evento
  status: "pending" | "published" | "failed";
  createdAt: Date;
  publishedAt?: Date;
}
```

Es la fuente de `WebhookDelivery`: cada `OutboxEvent` publicado genera N deliveries (una por endpoint suscripto). Te da garantía _at-least-once_ sin perder eventos si el proceso muere entre "guardé el pago" y "encolé el webhook".

---

## 10. Notificaciones al comercio (opcional) — día 4+

```ts
class Notification {
  id: EntityId;
  clientId: EntityId;
  channel: "email" | "dashboard";
  type: string; // 'payout.paid', 'dispute.opened', ...
  payload: json;
  status: "pending" | "sent" | "failed";
  readAt?: Date;
  createdAt: Date;
}
```

Solo si tenés dashboard o mandás mails. Si no, saltealo.

---

## Modelo mental completo

```
ApiClient
  ├── ApiKey                    (auth)
  ├── WebhookEndpoint           (config)
  ├── Payment ──┬── Refund
  │             ├── Dispute ──── DisputeEvidence
  │             └── Fee
  ├── Customer
  │     └── PaymentMethod
  ├── Plan ──── Subscription ──── SubscriptionInvoice
  ├── Payout ── PayoutItem
  ├── FeeSchedule
  ├── IdempotencyKey
  ├── OutboxEvent ──── WebhookDelivery
  └── Notification

RequestLog (auditoría, transversal)
```

---

## Lo que queda **afuera a propósito**

- **Ledger** (`Account`, `JournalEntry`, `LedgerLine`, `Balance`): sistema aparte, contabilidad de doble entrada. Lo modelás cuando lo construyas.
- **User / Role / Session**: ya lo descartaste en el archivo original.
- **DisputeEvidence** como array embebido en `Dispute` si querés simplificar (yo lo dejé separado porque suele tener uploads y auditoría propia).

**Regla general**: cada entidad de acá representa un _hecho de negocio_ (algo que pasó). El ledger es la _representación contable_ de esos hechos — por eso no se mezclan.
