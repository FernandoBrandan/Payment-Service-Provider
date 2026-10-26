# Mapa de integración --- Mercado Pago Checkout Pro

> Diagrama basado en `es.md`: integración de un e-commerce con Checkout
> Pro (redirección), creación de preferencias, Webhooks y reconciliación
> del estado del pago.

## 1. Flujo principal

``` mermaid
flowchart TD
    A["E-commerce / Frontend"] --> B["Backend del e-commerce"]
    B --> C["CreatePreferenceUseCase"]
    C --> D["Validar pedido e items"]
    D --> E["Construir preferencia<br/>items + external_reference + back_urls"]
    E --> F["Mercado Pago API<br/>POST /checkout/preferences"]
    F --> G["Respuesta: preference_id + init_point"]
    G --> H["Persistir CheckoutSession / PaymentLink"]
    H --> I["Devolver init_point al frontend"]
    I --> J["Redirigir comprador a Checkout Pro"]
    J --> K["Comprador completa el checkout"]
    K --> L["Mercado Pago procesa el pago"]

    L --> M["Webhook de Mercado Pago"]
    M --> N["Validar y registrar evento"]
    N --> O["Deduplicar / aplicar idempotencia"]
    O --> P["Consultar pago en Mercado Pago<br/>si hace falta confirmar el estado"]
    P --> Q["Mapear estado externo a estado interno"]
    Q --> R["Persistir Payment y actualizar Order"]
    R --> S["Disparar efectos posteriores<br/>notificación, stock, factura, etc."]

    K -. "Retorno del navegador<br/>solo para experiencia de usuario" .-> T["back_urls: success / pending / failure"]
    T -. "No usar como única fuente de verdad" .-> B
```

## 2. Secuencia: crear una preferencia

``` mermaid
sequenceDiagram
    autonumber
    actor Buyer as Comprador
    participant FE as Frontend e-commerce
    participant API as Backend e-commerce
    participant UC as CreatePreferenceUseCase
    participant DB as Base de datos
    participant MP as Mercado Pago API

    FE->>API: Solicitar link para el pedido
    API->>UC: Ejecutar con orderId / datos necesarios
    UC->>DB: Obtener pedido y sus items
    DB-->>UC: Order + OrderItems
    UC->>UC: Validar pedido y construir preferencia
    UC->>MP: POST /checkout/preferences<br/>Authorization: Bearer ACCESS_TOKEN
    MP-->>UC: preference_id + init_point
    UC->>DB: Guardar CheckoutSession / PaymentLink
    DB-->>UC: Confirmación de persistencia
    UC-->>API: preference_id + init_point
    API-->>FE: Devolver link de checkout
    FE->>Buyer: Redirigir a init_point
    Buyer->>MP: Completar checkout
```

## 3. Secuencia: confirmar el pago

``` mermaid
sequenceDiagram
    autonumber
    participant MP as Mercado Pago
    participant WH as Endpoint Webhook
    participant UC as ProcessPaymentUseCase
    participant DB as Base de datos
    participant API as API de Mercado Pago
    participant ORD as Order / efectos posteriores

    MP->>WH: Notificación del recurso de pago
    WH->>UC: Entregar evento / identificador
    UC->>DB: Registrar evento y comprobar deduplicación
    DB-->>UC: Resultado de idempotencia
    alt Evento ya procesado
        UC-->>WH: No repetir efectos
    else Evento nuevo
        UC->>API: Consultar estado real del pago
        API-->>UC: payment_id + status + detalles
        UC->>UC: Mapear estado externo a estado interno
        UC->>DB: Persistir Payment y relación con Order
        UC->>ORD: Actualizar estado de la orden
        UC->>ORD: Disparar efectos posteriores si corresponden
        UC-->>WH: Procesamiento aceptado
    end
    WH-->>MP: Respuesta HTTP exitosa
```

## 4. Entidades y responsabilidades mínimas

``` mermaid
classDiagram
    class Order {
      +orderId
      +items
      +totalAmount
      +currency
      +status
    }

    class OrderItem {
      +productId
      +title
      +quantity
      +unitPrice
    }

    class CheckoutSession {
      +id
      +orderId
      +preferenceId
      +initPoint
      +externalReference
      +status
      +createdAt
      +expiresAt
    }

    class Payment {
      +id
      +orderId
      +providerPaymentId
      +status
      +statusDetail
      +amount
      +createdAt
    }

    class WebhookEvent {
      +id
      +source
      +rawPayload
      +dedupeKey
      +processedAt
    }

    Order "1" *-- "1..*" OrderItem
    Order "1" --> "0..*" CheckoutSession
    Order "1" --> "0..*" Payment
    WebhookEvent ..> Payment : informa / actualiza
```

## 5. IDs que conviene correlacionar

  -----------------------------------------------------------------------
  Dato                                Para qué sirve
  ----------------------------------- -----------------------------------
  `orderId`                           Identificador interno del pedido en
                                      el e-commerce.

  `external_reference`                Correlaciona la preferencia/pago
                                      externo con el pedido propio.

  `preference_id`                     Identifica la preferencia creada en
                                      Mercado Pago.

  `init_point`                        URL de Checkout Pro a la que se
                                      redirige al comprador.

  `payment_id`                        Identifica el pago externo al
                                      consultar su estado.

  `event id` o `dedupeKey`            Evita procesar repetidamente una
                                      misma notificación.
  -----------------------------------------------------------------------

## 6. Reglas importantes

-   **El redirect no confirma por sí solo el pago.** Se utiliza para la
    experiencia del comprador; la confirmación debe basarse en la
    notificación y/o en la consulta del estado real mediante la API.
-   **Aplicar idempotencia.** Los Webhooks pueden repetirse; registrar
    el evento y evitar ejecutar dos veces los mismos efectos.
-   **No exponer credenciales.** El Access Token se usa desde el backend
    en `Authorization: Bearer ...`.
-   **Persistir la correlación.** Guardar la relación entre `orderId`,
    `external_reference`, `preference_id` y, cuando esté disponible,
    `payment_id`.
-   **Separar estados.** La preferencia/link y el pago son conceptos
    distintos: crear un link no significa que el pedido esté pagado.
-   **Responder rápido al Webhook.** Para trabajo pesado, se puede
    aceptar la notificación y procesar los efectos de forma asíncrona,
    con persistencia y reintentos controlados.

## 7. Alcance de este diagrama

Este mapa representa una **integración de un e-commerce con Mercado Pago
Checkout Pro**. No modela una implementación propia de un proveedor de
pagos ni un ledger contable. Los nombres y recursos externos deben
verificarse contra la versión vigente de la documentación de Mercado
Pago antes de implementar.
