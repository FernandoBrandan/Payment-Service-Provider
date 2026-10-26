# Own Payment Provider — Blueprint consolidado v1

- Documento base para implementar el Servicio 3.
- Resume las decisiones acordadas y separa explícitamente lo que sigue pendiente.
- **Alcance inicial:** provider de pagos simulado, checkout con saldo interno y Ledger como autoridad contable.
- No incluye inicialmente carga real de dinero, tarjetas, Stripe, comisiones, reembolsos ni liquidaciones.

## 1. Los cuatro servicios

| Servicio                          | Responsabilidad                                                                                                                                   | Fuente de verdad                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **S1 — E-commerce**               | Productos, clientes, órdenes. Publica órdenes creadas y recibe el resultado del pago.                                                             | Estado comercial de la orden.                          |
| **S2 — Payment Orchestrator API** | Recibe la orden, crea el pago lógico, selecciona el provider y actualiza su pago mediante el resultado del provider.                              | Pago desde la perspectiva del e-commerce/orquestación. |
| **S3 — Own Payment Provider API** | Autentica al integrador, crea operaciones y enlaces de checkout, autentica al comprador y coordina el pago con saldo. Notifica el resultado a S2. | Operación de pago del provider.                        |
| **S4 — Ledger**                   | Valida cuentas y reglas contables; registra transacciones y entries de manera atómica.                                                            | Saldos y movimientos contables registrados.            |

Los servicios no comparten tablas ni entidades ORM. Se comunican mediante contratos HTTP y/o mensajes. `orderId`, `externalPaymentId` y `ledgerTransactionId` son referencias entre contextos, no relaciones de base de datos entre servicios.

### Dueños de datos

- S1 es dueño de la orden.
- S2 es dueño del pago lógico/orquestado.
- S3 es dueño del `ProviderPayment`, los enlaces de checkout y la identidad propia del provider.
- S4 es dueño de cuentas contables, transacciones, entries y saldos contables.
- S3 **no** mantiene un saldo independiente que compita con el Ledger.

## 1. Arquitectura del servicio

- API Access: Autenticación entre servicios: `ApiClient` · `ApiCredential` · `ApiKeyGuard`
- Identity: Identidad del comprador y del comercio dentro del provider: `ProviderUser` · autenticación · `MerchantProfile`
- Payments & Checkout: Dominio principal del provider: `ProviderPayment` · enlace de pago · checkout · procesamiento del pago
- Integraciones: Comunicación con sistemas externos: `LedgerPort` / `LedgerHttpAdapter` · `WebhookPublisher` · repositorios

| Entidad           | Responsabilidad                                                        |
| ----------------- | ---------------------------------------------------------------------- |
| `ApiClient`       | Integrador autorizado, en este caso el servicio 2.                     |
| `ApiCredential`   | Identifica una credencial revocable del integrador.                    |
| `ProviderUser`    | Usuario que inicia sesión en el provider.                              |
| `MerchantProfile` | Representa al comercio receptor.                                       |
| `ProviderPayment` | Pago del provider: importe, estado, comprador, comercio y referencias. |
| `PaymentLink`     | Acceso al checkout, con vencimiento y token.                           |

- `ProviderUser` no es una cuenta contable
- Un usuario del provider tiene una identidad y un mecanismo para autenticarse.
- Su perfil puede guardar una referencia como `ledgerAccountId`.
- El servicio 3 no guarda el saldo de Ana como fuente de verdad.
- Consulta al Ledger cuando necesita mostrarlo o pagar con él.
- El comercio también tendrá una identidad o perfil dentro del provider y una cuenta receptora en el Ledger.

## 2. Arquitectura de S3

Implementar inicialmente **un solo servicio NestJS**, modularizado por responsabilidad.
No crear microservicios separados para API keys, identidad y pagos todavía.
No es necesario crear todos los archivos desde el primer día.
Esta estructura es una dirección arquitectónica, no una lista de clases obligatorias.

## 3. Módulos de S3

### 3.1 API Access

Autentica a S2 (el integrador) cuando consume los endpoints privados del provider.

- `ApiClient`: integrador autorizado, asociado al comercio que puede cobrar.
- `ApiCredential`: credencial revocable, con estado, prefijo/identificador y hash.
- `ApiCredential` (Entidad) Protege la lógica de validación de la API Key. **Nunca** expone la key en texto plano, solo el hash.
- `AuthenticateApiKeyUseCase`.
- `ApiKeyGuard`.

El secreto completo se muestra una sola vez y no se almacena en texto plano.
Comparar de forma segura cuando corresponda. No loguear la key.

La API key autentica a S2; **no autentica al comprador ni demuestra que un pago ocurrió**. El secreto usado para firmar webhooks es independiente de la API key.

### 3.2 Identity

- `ProviderUser` (Entidad) Representa al comprador. Su comportamiento principal es la autenticación y el control de estado.
- `ProviderUser`: usuario que inicia sesión en el checkout y cuyo identificador enlaza con una cuenta de S4.
- `MerchantProfile`: comercio receptor y referencia a su cuenta de S4.
- `MerchantProfile` (Entidad) Representa al comercio que recibe el dinero.

Referencias importantes:

- `ProviderUser.ledgerAccountId` no es el saldo; apunta a una cuenta que solo S4 administra.
- `MerchantProfile.ledgerAccountId` es la cuenta contable de destino.
- No asumir `userId === accountId`.
- No asumir que la identidad de S1 es la misma entidad que la identidad de S3.

### !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

**Decisión pendiente que debe cerrarse antes de habilitar pagos reales:**
¿cómo se vincula el cliente de S1 con `ProviderUser`?
Opciones: S2/S3 mantiene un mapeo explícito, o el request incluye una referencia externa de comprador que S3 resuelve.
Para el MVP no permitir que un comprador no previsto cambie la identidad del pagador enviando un ID desde el navegador.
Si se desea permitir que cualquier usuario del provider pague el enlace, debe ser una regla de negocio explícita.

### 3.3 Payments & Checkout

- `ProviderPayment` (Entidad - Raíz del Agregado) Esta entidad **protege el ciclo de vida del pago**. Nadie (ni siquiera el caso de uso) puede cambiar el estado a `SUCCEEDED` sin pasar por las validaciones internas.

Entidad central: `ProviderPayment` (aggregate root).

Campos conceptuales:

- `id` (ID interno de S3).
- `apiClientId` o referencia al integrador propietario.
- `externalPaymentId` (ID del pago creado en S2).
- `orderId` (referencia a S1).
- `merchantId`.
- `amountMinorUnits` y `currency`.
- `description`.
- `status`.
- `checkoutTokenHash`.
- `ledgerTransactionId`, cuando S4 confirma.
- `createdAt`, `expiresAt`.
- campos de auditoría/reconciliación según se necesiten.

Estados recomendados:

```text
PENDING -> PROCESSING -> SUCCEEDED
                       -> FAILED
                       -> RECONCILIATION_REQUIRED -> SUCCEEDED / FAILED
PENDING -> EXPIRED
```

Definiciones:

- `PENDING`: pago creado, todavía no se está procesando el cobro.
- `PROCESSING`: S3 ha reclamado el intento y está coordinando el movimiento con S4.
- `SUCCEEDED`: S4 confirmó la transacción contable y S3 guardó el `ledgerTransactionId`.
- `FAILED`: fallo definitivo conocido, por ejemplo saldo insuficiente devuelto explícitamente por S4.
- `EXPIRED`: el checkout venció sin que comenzara un procesamiento válido.
- `RECONCILIATION_REQUIRED`: resultado de S4 desconocido (p. ej., timeout sin saber si el movimiento se registró); debe investigarse/reintentarse idempotentemente, no tratarse como fallo confirmado.

Invariantes:

- Un pago no se contabiliza dos veces.
- No se puede comenzar un pago expirado.
- El importe, la moneda, el pagador y el comercio se resuelven en backend; no se confían al navegador.
- `SUCCEEDED` exige un `ledgerTransactionId` válido.
- Un estado final no vuelve a `PENDING`.
- El cambio de `PENDING` a `PROCESSING` debe reclamarse atómicamente en la base de datos. Un `canBeProcessed()` seguido de `save()` no evita por sí solo carreras concurrentes.

`PaymentLink` puede empezar como datos de `ProviderPayment` (token hash y vencimiento); convertirlo en entidad independiente solo si necesita un ciclo de vida propio.

### 3.4 Integrations / ports

Estas interfaces viven en el dominio, pero sus **implementaciones** vivirán en la carpeta `infrastructure`. Esto es lo que inyectarás en tus Casos de Uso.

- `LedgerPort` (Puerto hacia el Servicio 4) Define cómo el Provider solicita un movimiento contable.
- `WebhookPublisherPort` (Puerto de Notificación) Define cómo se comunica el resultado final al Servicio 2.
- `PaymentRepository` (Puerto de Persistencia) El contrato para guardar y recuperar la entidad `ProviderPayment`.

S3 depende de contratos definidos en application/domain y de adaptadores concretos en infraestructura.

```ts
export interface TransferFundsCommand {
  idempotencyKey: string;
  debitAccountId: string;
  creditAccountId: string;
  amountMinorUnits: string; // o entero seguro, con una convención única
  currency: string;
  reference: string;
}

export type LedgerTransferResult =
  | { kind: "SUCCEEDED"; ledgerTransactionId: string }
  | { kind: "REJECTED"; errorCode: string }
  | { kind: "UNKNOWN" };

export interface LedgerPort {
  requestTransfer(command: TransferFundsCommand): Promise<LedgerTransferResult>;
}
```

La forma exacta de serializar los importes se decide una vez y se aplica en los cuatro servicios.
El resultado `UNKNOWN` representa un timeout/error de transporte donde no puede saberse si S4 registró la operación.

Otros contratos:

- `ProviderPaymentRepository`: buscar por ID, por integrador + external ID/idempotency key y por hash del token; guardar con control de concurrencia.
- `ProviderUserRepository`.
- `MerchantProfileRepository`.
- `WebhookPublisherPort`: publica eventos hacia S2 mediante un Outbox/worker.

## 4. Dinero y cuentas: convención obligatoria

No mezclar `amount`, `amountInCents`, pesos y unidades menores.

Recomendación: usar `amountMinorUnits` para un entero expresado en la unidad menor de la moneda, y `currency` como código ISO 4217. Para ARS, con dos decimales:

- ARS 100,00 = `10000` unidades menores.
- ARS 10.000,00 = `1000000` unidades menores.

Por lo tanto, el ejemplo de una compra de **ARS 10.000,00** debe enviar `amountMinorUnits: 1000000`, no `10000`. Nunca utilizar `number` de punto flotante para aritmética monetaria. Elegir un tipo entero/decimal compatible con el rango del sistema y definir explícitamente su serialización JSON/DB.

El Ledger valida que la cuenta del comprador tenga fondos disponibles y registra débito + crédito en una única transacción atómica. Este blueprint no incluye comisiones ni cuentas intermedias.

## 5. Contratos HTTP de referencia

### 5.1 S2 -> S3: crear pago y checkout

```http
POST /v1/payments
Authorization: Bearer <service-api-key>
Idempotency-Key: <stable-key>
Content-Type: application/json
```

```json
{
  "externalPaymentId": "payment_123",
  "orderId": "order_456",
  "amountMinorUnits": 1000000,
  "currency": "ARS",
  "description": "Compra de producto"
}
```

La cifra del ejemplo representa ARS 10.000,00.

S3 obtiene el comercio permitido a partir del `ApiClient` autenticado; no acepta un `merchantAccountId` arbitrario del body. Debe aplicar idempotencia: misma key + mismo payload = devolver el mismo resultado; misma key + payload distinto = conflicto. Persistir una restricción única en DB; no confiar solo en una consulta previa.

Respuesta de referencia:

```json
{
  "providerPaymentId": "opp_789",
  "status": "PENDING",
  "checkoutUrl": "https://pay.example.com/checkout/<token>",
  "expiresAt": "2026-10-18T15:00:00Z"
}
```

Generar un token aleatorio difícil de adivinar, guardar su hash y devolver el token solo para formar el enlace. Definir expiración y no incluir datos sensibles en la URL.

### 5.2 Comprador -> S3: pagar desde checkout

```http
POST /v1/checkout/{token}/pay
Cookie: session=<buyer-session>
Idempotency-Key: <checkout-attempt-key>
```

El usuario se autentica en S3. El backend busca el pago por el hash del token, verifica vencimiento/estado/identidad permitida y reclama atómicamente la transición a `PROCESSING`. El navegador no envía importe, moneda ni cuentas contables.

### 5.3 S3 -> S4: transferir saldo

```http
POST /v1/transfers
Authorization: Bearer <ledger-service-credential>
Idempotency-Key: opp_789
```

```json
{
  "reference": "opp_789",
  "debitAccountId": "buyer-ledger-account-id",
  "creditAccountId": "merchant-ledger-account-id",
  "amountMinorUnits": 1000000,
  "currency": "ARS"
}
```

El adaptador construye las cuentas usando datos resueltos en S3, no datos del navegador. S4 valida las cuentas y los fondos, y aplica la transacción y sus entries atómicamente. La key debe identificar la operación lógica y seguir siendo la misma en cada reintento. S4 debe devolver el resultado original para una repetición idempotente.

### 5.4 S3 -> S2: webhook de resultado

## Contratos HTTP entre los servicios

### Servicio 2 → Servicio 3: crear el enlace

```
POST /v1/payments
Authorization: Bearer <service-api-key>
Idempotency-Key: order-payment-123
Content-Type: application/json
```

```
{
  "externalPaymentId": "payment_123",
  "orderId": "order_456",
  "amount": 10000,
  "currency": "ARS",
  "description": "Compra de producto"
}
```

Respuesta:

```
{
  "providerPaymentId": "opp_789",
  "status": "PENDING",
  "checkoutUrl": "https://pay.example.com/checkout/<token>",
  "expiresAt": "2026-10-17T15:00:00Z"
}
```

El servicio 3 obtiene el comercio asociado al `ApiClient` autenticado. No confiaría en un `merchantAccountId` arbitrario enviado en el body: el cliente autenticado debe estar vinculado al comercio que puede cobrar.

El enlace utiliza un token aleatorio difícil de adivinar, con expiración. Se puede almacenar su hash en la base de datos para no conservar el token de acceso en claro.

### Comprador → Servicio 3: pagar

La URL lleva al checkout alojado por tu provider. El usuario inicia sesión y confirma el pago con su saldo.

```
POST /v1/checkout/{token}/pay
```

La sesión del usuario identifica al comprador. El servidor obtiene de su propio registro el importe, la moneda, el comercio receptor y la cuenta contable vinculada al comprador.

El navegador nunca envía instrucciones contables ni decide el importe definitivo.

### Servicio 3 → Servicio 4: solicitar el movimiento

No haría que el provider construya libremente las `Entries` del Ledger. Es mejor que solicite una operación de negocio que el Ledger valide y contabilice.

```
POST /v1/transfers
Authorization: Bearer <ledger-service-credential>
Idempotency-Key: opp_789
```

```
{
  "reference": "opp_789",
  "debitAccountId": "buyer-account-id",
  "creditAccountId": "merchant-account-id",
  "amount": 10000,
  "currency": "ARS"
}
```

El Ledger valida ambas cuentas, el saldo disponible y la moneda; después crea la `Transaction` y sus `Entries` en una única transacción de base de datos. La operación debe ser idempotente.

Este contrato es ilustrativo. Si preferís que el Ledger tenga una API específica, podría llamarse `POST /v1/payment-transfers` y aceptar un `providerPaymentId` como referencia.

### Servicio 3 → Servicio 2: comunicar el resultado

Tras confirmar el registro contable, el provider envía un webhook firmado con el estado final.

```
{
  "eventId": "evt_001",
  "type": "payment.succeeded",
  "providerPaymentId": "opp_789",
  "externalPaymentId": "payment_123",
  "orderId": "order_456",
  "amount": 10000,
  "currency": "ARS",
  "ledgerTransactionId": "txn_321"
}
```

El servicio 2 valida la firma, deduplica el evento y actualiza su pago. Luego notifica al e-commerce.

Importante: si la llamada al Ledger termina en timeout, no podés asumir que falló el movimiento. Puede haberse registrado correctamente y haberse perdido la respuesta. Usá la misma clave de idempotencia al reintentar y contemplá reconciliación.

```json
{
  "eventId": "evt_001",
  "type": "payment.succeeded",
  "providerPaymentId": "opp_789",
  "externalPaymentId": "payment_123",
  "orderId": "order_456",
  "amountMinorUnits": 1000000,
  "currency": "ARS",
  "ledgerTransactionId": "txn_321",
  "timestamp": "2026-10-18T15:01:00Z"
}
```

Firmar el payload con un secreto HMAC independiente de la API key. S2 verifica la firma y deduplica usando `eventId`. El worker marca el evento entregado solo luego de recibir 2xx; reintenta los errores transitorios con backoff. Validar timestamps/ventana de repetición cuando se implemente la firma.

## 6. Happy path completo

1. S1 crea una orden y publica `OrderCreated` por RabbitMQ.
2. S2 recibe la orden y crea su pago lógico.
3. S2 llama `POST /v1/payments` en S3 con API key e idempotency key.
4. S3 autentica el integrador, resuelve su comercio, crea `ProviderPayment = PENDING`, genera el token, persiste el pago y responde con `checkoutUrl`.
5. El comprador abre el enlace, inicia sesión en S3 y elige pagar con saldo.
6. S3 valida la sesión, el token, el estado del pago y la identidad del pagador según la política definida.
7. S3 reclama atómicamente el intento y pasa el pago a `PROCESSING`.
8. S3 solicita la transferencia a S4 con `idempotencyKey = providerPaymentId`.
9. S4 valida saldo/cuentas y registra débito + crédito de forma atómica.
10. Si S4 confirma, S3 persiste `SUCCEEDED`, `ledgerTransactionId` y el evento Outbox en una misma transacción local.
11. Un worker firma y envía el webhook a S2. S2 deduplica y actualiza el pago lógico.
12. S2 comunica a S1 el resultado y S1 marca la orden como pagada.

La redirección del navegador a una pantalla de éxito es solo UX. La fuente de verdad del resultado son las respuestas persistidas en backend y la confirmación contable de S4.

## 5. Flujo happy path

1. **Servicio 2 → Servicio 3**
   `POST /v1/payments` con `Authorization: Bearer <api-key>` e `Idempotency-Key`.
2. Servicio 3 crea `ProviderPayment = PENDING`, genera token de checkout y devuelve `checkoutUrl`.
3. **Comprador → Servicio 3**
   `POST /v1/checkout/{token}/pay` con sesión de usuario.
4. Servicio 3 pasa el pago a `PROCESSING`.
5. **Servicio 3 → Ledger**
   `POST /v1/transfers` con `Idempotency-Key = providerPaymentId`.
6. Ledger debita comprador, acredita comercio y confirma.
7. Servicio 3 marca `SUCCEEDED` y guarda/emite webhook.
8. **Servicio 3 → Servicio 2**
   Webhook firmado; Servicio 2 valida firma, deduplica y actualiza.
9. Servicio 2 confirma al e-commerce.

**Timeout con Ledger**: no asumir fallo. Reintentar con la misma idempotency key y contemplar reconciliación.

A. Payment Orchestrator - Pide un enlace al provider usando su API key.
B. ProviderPayment = PENDING - Persiste el pago y el enlace; responde al servicio 2.
C. Checkout - El comprador inicia sesión y pulsa Pagar con saldo.
D. ProviderPayment = PROCESSING - Comprueba el pago y solicita la transferencia al Ledger.
E. Ledger - Debita al comprador, acredita al comercio y confirma el registro.
F. ProviderPayment = SUCCEEDED - Persiste el resultado y genera un evento de webhook.
G. Servicio 2 → E-commerce - Confirma el pago y actualiza la orden.

Dos recomendaciones para que el flujo sea recuperable:

- Idempotencia: la doble pulsación, los reintentos HTTP y la repetición de mensajes no deben provocar dos débitos.
- Outbox para los webhooks: guardá el evento pendiente de envío en la misma transacción de base de datos que actualiza el pago. Un worker lo envía y reintenta hasta obtener respuesta.

El estado de un pago no debe depender de que el navegador llegue a una página de éxito. La redirección del checkout es solo una experiencia de usuario; la confirmación definitiva viene del backend y del Ledger.

## 7. Recuperación y concurrencia

### Rechazo definitivo de S4

Ejemplo: saldo insuficiente confirmado. S3 puede marcar `FAILED` y generar el evento de resultado correspondiente.

### Timeout / resultado desconocido de S4

No marcar `FAILED` solo por timeout. Conservar `PROCESSING` o mover a `RECONCILIATION_REQUIRED`; reintentar usando la misma idempotency key o consultar S4 para recuperar el resultado. Puede que S4 haya cometido el movimiento y se haya perdido la respuesta.

### Crash después de confirmar S4

Si S4 confirmó pero S3 cayó antes de guardar `SUCCEEDED`, el reintento debe consultar/repetir la misma operación idempotente en S4, recuperar el mismo `ledgerTransactionId` y completar el estado local.

### Doble clic / concurrencia

- Cambiar `PENDING -> PROCESSING` con compare-and-set/actualización condicional, bloqueo o control de versión.
- Solo el ganador inicia la operación; la otra petición devuelve el estado existente o una respuesta de procesamiento.
- Agregar restricciones únicas para las claves de idempotencia.
- No depender solo de un check en memoria ni de `canBeProcessed()` antes de guardar.

### Outbox

Guardar el evento que debe enviarse a S2 dentro de la misma transacción de DB que guarda el estado final en S3. El worker envía y reintenta por separado. Outbox evita perder el evento luego del commit local, pero no hace atómica la operación distribuida entre S3 y S4; la idempotencia y reconciliación con S4 siguen siendo necesarias.

## 8. Seguridad mínima

- TLS fuera del entorno local.
- API key de S2 con alta entropía, hash almacenado y revocación.
- Secreto de firma de webhooks independiente.
- Sesión de comprador distinta de la autenticación servicio-a-servicio.
- El checkout no acepta montos ni cuentas enviados por el navegador.
- Validar ownership/autorización del `ApiClient` respecto del comercio.
- Rate limiting, expiración de tokens y logs sin secretos.
- No confiar en un redirect del navegador ni en un webhook sin firma/verificación.
- Guardar auditoría suficiente para reconciliar pagos.

## 9. Clases/casos de uso mínimos

Primera implementación sugerida:

- Entidad `ProviderPayment` con invariantes y transiciones de estado.
- Value object `Money` o equivalente, con una única convención de unidades menores.
- `CreatePaymentLinkUseCase`.
- `ProcessPaymentUseCase`.
- `LedgerPort` + `LedgerHttpAdapter`.
- `ProviderPaymentRepository` + implementación de persistencia.
- `ApiKeyGuard` y un `ApiClient` inicial.
- Checkout con autenticación del comprador.
- Outbox + worker de webhooks (puede ser una versión simple al principio, pero no perder eventos).

`ProviderUser`, `MerchantProfile` y `ApiCredential` son conceptos que pueden representarse con clases de dominio si tienen estado, identidad y reglas; no convertir cada DTO en entidad. Una interfaz TypeScript describe un contrato, pero no implementa las invariantes de una entidad.

## 10. Roadmap

| Etapa | Alcance                                                                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1     | Happy path: un provider, una moneda, usuarios y comercios precargados, saldo simulado en S4.                                  |
| 2     | Fallos y concurrencia: saldo insuficiente, vencimiento, duplicados, doble clic, timeout, reconciliación y webhooks repetidos. |
| 3     | Alta/login de usuarios y comercios, credenciales administrables y permisos.                                                   |
| 4     | Carga de saldo simulada; luego investigar fuentes externas y conciliación.                                                    |
| 5     | Reembolsos, comisiones, retenciones, liquidaciones y retiros.                                                                 |
| 6     | Varios providers/métodos (Mercado Pago, Stripe, tarjetas) y selección de provider/método.                                     |

No abriría todas las variantes de golpe. Cada etapa debería agregar un problema de negocio o de ingeniería concreto.

### Etapa 1 — Happy path mínimo

Un provider, un método de pago (saldo), una moneda, un comercio y usuarios precargados en el Ledger. Sin cargar dinero real, comisiones ni reembolsos.

Objetivo: validar el modelo, las cuatro APIs y el movimiento contable.

### Etapa 2 — Fallos y concurrencia

Saldo insuficiente, pago vencido, doble clic, orden duplicada, webhook repetido, caída del Ledger y timeout con resultado desconocido.

Objetivo: lograr idempotencia, recuperación y transiciones de estado correctas. Más adelante, probar dos compras concurrentes que intentan gastar el mismo saldo.

### Etapa 3 — Usuarios y comercios reales dentro del sistema

Registro e inicio de sesión, bloqueo de usuarios, alta de comercios, cuentas asociadas en el Ledger, permisos y administración de API keys.

Objetivo: pasar de usuarios de prueba a identidades y operaciones administrables, sin que el provider sea dueño de los saldos.

### Etapa 4 — Carga de saldo

Simular depósitos o acreditar fondos mediante un proceso explícito del Ledger. Después, estudiar integraciones con fuentes externas, conciliación y controles de fraude.

Objetivo: que el saldo provenga de movimientos contables identificables, en lugar de ser un número precargado sin historial.

### Etapa 5 — Funciones financieras

Reembolsos, comisiones, anulaciones, retenciones temporales, liquidaciones y retiros de los comercios.

Objetivo: modelar movimientos adicionales y sus efectos contables sin editar los registros históricos para simular que nunca ocurrieron.

### Etapa 6 — Varios providers y métodos

Agregar Stripe y Mercado Pago simulados o reales; decidir qué provider crea el checkout, qué medios de pago ofrece y cómo se registran los resultados.

Objetivo: consolidar la interfaz común del servicio 2 y las diferencias entre cada proveedor.

## 8. Decisiones fijas

- **Saldo**: dueño = Ledger.
- **Usuario del provider**: lo conoce Servicio 3.
- **Orden ↔ pago lógico**: lo asocia Servicio 2.
- **Estado del pago del provider**: lo mantiene Servicio 3.
- **Transaction/Entries**: los registra Ledger.
- **Autenticación del Servicio 2**: Servicio 3 vía API key.
- **Autenticación del comprador**: Servicio 3 vía sesión.
- **Confirmación al e-commerce**: Servicio 2.

| Decisión                                       | Elección                                         |
| ---------------------------------------------- | ------------------------------------------------ |
| Quién es dueño del saldo                       | Ledger                                           |
| Quién conoce al usuario del provider           | Servicio 3                                       |
| Quién asocia la orden con el pago lógico       | Servicio 2                                       |
| Quién mantiene el estado del pago del provider | Servicio 3                                       |
| Quién registra `Transaction` y `Entries`       | Ledger                                           |
| Quién autentica al servicio 2                  | Servicio 3, mediante credenciales de integración |
| Quién autentica al comprador                   | Servicio 3, mediante sesión de usuario           |
| Quién confirma la orden al e-commerce          | Servicio 2                                       |

Las API keys deberían guardarse en el servicio 3 como hashes verificables, no en texto plano. El servicio 2 conserva su copia secreta en configuración segura. La gestión de credenciales es un módulo, no una razón para separar otro microservicio.

## 11. Decisiones pendientes (no inventar una respuesta)

1. **Vinculación de identidad:** cómo se relaciona el comprador del e-commerce con `ProviderUser` y si el enlace solo puede ser pagado por ese comprador o por cualquier usuario autenticado.
2. **Política de pago fallido:** qué errores de S4 son rechazo definitivo y cuáles requieren conciliación.
3. **Contrato real del Ledger:** endpoint, DTO y modelo exacto de `Transaction`/`Entries`; el endpoint `/v1/transfers` de este documento es ilustrativo.
4. **Moneda y montos:** mantener `amountMinorUnits` de punta a punta y definir límites/tipo de DB/serialización.
5. **Notificación a S2:** URL/secret por integración; para el MVP puede venir de configuración segura, no del body de crear pago.
6. **Infraestructura:** si Outbox usa tabla PostgreSQL y worker propio o RabbitMQ. No hace falta decidir una plataforma de mensajería adicional solo para empezar.

## 12. Decisión de alcance

La versión inicial debe demostrar que una orden puede convertirse en un pago del provider y que el Ledger registra un único movimiento de saldo antes de que S2/S1 reciban la confirmación.

No construir ahora: depósitos reales, integraciones bancarias, Stripe, comisiones, reembolsos, retiros, múltiples divisas complejas ni un microservicio separado de API keys.

### El alcance exacto de tu primera versión

Yo construiría ahora solamente `Api Access`, `Identity`, `Payments & Checkout` y la integración HTTP con el Ledger, con un único provider activo. No haría todavía cargas de dinero, Stripe, comisiones ni liquidaciones.

Así tu primer proyecto ya tendría decisiones reales de backend para demostrar: modelo de dominio, estados, autenticación, idempotencia, transacciones contables distribuidas y webhooks confiables. Y cada etapa posterior se puede añadir como un problema nuevo, sin convertir desde el día uno el clon de Mercado Pago en una plataforma gigantesca.

### ¿Por qué este diseño es ideal para tu MVP?

1. **Cero "Anemia":** `ProviderPayment` no es un DTO. Tiene métodos como `markAsSucceeded` que _exigen_ un `ledgerTransactionId`. Si un desarrollador intenta cambiar el estado a mano (`payment.status = 'SUCCEEDED'`), TypeScript o la lógica interna lo bloquearán.
2. **Idempotencia nativa:** El `idempotencyKey` en el `TransferFundsCommand` obliga a pensar en la doble ejecución desde el día 1.
3. **Desacople total:** El dominio de Pagos no sabe si el Ledger usa PostgreSQL, MongoDB o una API REST. Solo conoce `ILedgerPort`.
4. **Escalabilidad:** Cuando llegues a la "Etapa 5" (Reembolsos), solo agregarás `markAsRefunded()` a la entidad `ProviderPayment` y un nuevo método al `ILedgerPort`, sin romper el flujo de pago existente.
