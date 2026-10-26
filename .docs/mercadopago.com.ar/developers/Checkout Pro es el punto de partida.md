# 1. La idea principal: Checkout Pro es el punto de partida, no todo el sistema de pagos

Actualmente estás trabajando con Checkout Pro: tu backend crea una preferencia, recibe un `preference_id` y un `init_point`, y tu frontend redirige al comprador a Mercado Pago.

Eso alcanza para construir un e-commerce funcional. Pero en un entorno real aparecen otras necesidades: saber con certeza si se pagó, devolver dinero, resolver disputas, conciliar las ventas con los movimientos de tu cuenta y, eventualmente, vender por suscripción o aceptar pagos presenciales.

La documentación oficial de Mercado Pago separa estas capacidades en soluciones de checkout, gestión de pagos, notificaciones, reportes y productos adicionales.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.mercadopago.com.ar\&sz=32)

Mercado Pago Developers

+1



La clave es distinguir tres clases de funcionalidades:

A. Funcionalidades que complementan Checkout Pro

Webhooks, consulta del estado del pago, reembolsos, manejo de contracargos y conciliación. Son las primeras que conviene aprender.

B. Configuraciones para mejorar tu checkout

Vencimiento de la preferencia, medios de pago permitidos, datos de envío, referencias externas y experiencia del comprador.

C. Otros productos o modalidades de Mercado Pago

Suscripciones, Checkout API, Bricks, Split Payments para marketplaces, QR y terminales Point. Se incorporan cuando el negocio lo necesita, no por obligación.

Voy a recorrerlos con ejemplos concretos, especialmente pensando en tu backend NestJS y en cómo modelar estos procesos sin llenar la arquitectura de integraciones innecesarias.

# 2. Funcionalidades que deberías incorporar alrededor de Checkout Pro

## 1. Webhooks: enterarte de que un pago cambió

Prioridad máxima

Problema: el comprador termina de pagar, pero tu e-commerce no sabe con certeza qué ocurrió.

Supongamos que tu flujo es:

1. El backend crea una preferencia.
2. El frontend recibe el `init_point` y redirige al comprador.
3. El comprador paga.
4. Mercado Pago procesa la operación.
5. Tu e-commerce necesita actualizar el pedido.

Podrías esperar a que el comprador vuelva a tu sitio mediante `back_urls.success`. Pero hay un problema: podría cerrar el navegador, perder la conexión o no volver a tu web.

Los Webhooks resuelven esa comunicación: Mercado Pago envía una notificación HTTP cuando ocurren eventos configurados en la integración.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.mercadopago.com.ar\&sz=32)

Mercado Pago Developers



Ejemplo de tu sistema:

```
E-commerce
    |
    | CreatePreferenceUseCase
    v
Mercado Pago Checkout Pro
    |
    | Comprador paga
    v
Mercado Pago procesa el pago
    |
    | Webhook
    v
POST /webhooks/mercadopago
    |
    v
ProcessPaymentUseCase
    |
    +--> Verificar evento
    +--> Consultar estado real si corresponde
    +--> Actualizar Payment
    +--> Actualizar Order
    +--> Confirmar compra
```

En NestJS podrías tener:

```
payments/
├── application/
│   └── use-cases/
│       └── process-payment-notification.use-case.ts
├── domain/
│   └── entities/
│       └── payment.entity.ts
└── infrastructure/
    ├── http/
    │   └── mercadopago-webhook.controller.ts
    └── persistence/
```

El controlador recibe la notificación; el caso de uso coordina el procesamiento; el dominio mantiene las reglas de estado.

Cuándo lo necesitás: desde el momento en que tu e-commerce debe reaccionar de manera confiable al resultado de un pago. Es de las primeras funcionalidades que incorporaría después de crear la preferencia.

No significa que el Webhook siempre traiga toda la información definitiva: tratá la notificación como un evento que inicia la verificación del recurso correspondiente.

Documentación: [Webhooks para Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/notifications?utm_source=chatgpt.com).&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.mercadopago.com.ar\&sz=32)

Mercado Pago Developers



## 2. Consultar el estado real del pago

Problema: recibís una notificación, pero necesitás saber si el pago está aprobado, pendiente, rechazado o si hubo una actualización posterior.

Imaginá que recibís un evento que identifica un pago. No conviene marcar la orden como `PAID` basándote únicamente en parámetros enviados por el navegador o en datos no verificados del evento.

Tu backend necesita consultar el recurso correspondiente de Mercado Pago para contrastar el estado.

Ejemplo conceptual:

```
Webhook recibido
      |
      v
Extraer identificador del recurso
      |
      v
Consultar estado en Mercado Pago
      |
      v
Validar:
- Identidad del pago
- Relación con el pedido
- Importe y moneda
- Estado actual
      |
      v
Aplicar transición de estado
```

En tu modelo interno podrías utilizar:

```
Payment:
  id
  orderId
  preferenceId
  providerPaymentId
  status
  amount
  currency
```

La preferencia identifica la configuración del checkout; el pago representa una operación concreta. No son intercambiables.

### Ejemplo de un caso difícil

Una compra tiene esta secuencia:

```
Order: PENDING_PAYMENT

Payment:
  status = PENDING

Más tarde...

Payment:
  status = APPROVED
```

La orden solo debe pasar a `PAID` cuando tu sistema haya validado la aprobación de la operación y se cumplan las reglas de tu negocio.

Cuándo lo necesitás: con Webhooks, para verificar eventos; también para soporte, reconciliación y recuperación cuando una notificación se pierde o hay una inconsistencia.

En el checkout por preferencias, distinguí siempre el identificador de la preferencia (`preference_id`) del identificador del pago (`payment_id`). La documentación tiene recursos diferentes para crear preferencias, recibir notificaciones y consultar pagos.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.mercadopago.com.ar\&sz=32)

Mercado Pago Developers



## 3. Idempotencia y deduplicación

Problema: los sistemas distribuidos repiten solicitudes y eventos. ¿Qué pasa si Mercado Pago notifica el mismo cambio dos veces o un cliente presiona dos veces el botón de pagar?

Considerá este escenario:

```
Webhook 1 ──> Order pasa a PAID
Webhook 2 ──> ¿Vuelvo a facturar?
Webhook 3 ──> ¿Vuelvo a enviar el producto?
```

La respuesta debe ser no.

Tu sistema tiene que impedir que el mismo evento o la misma transición de negocio produzca dos veces los mismos efectos.

Ejemplos de mecanismos:

- Registrar los eventos procesados con una clave de deduplicación apropiada.
- Hacer que las transiciones de estado sean seguras frente a reintentos.
- Usar restricciones únicas en la base de datos cuando correspondan.
- Separar la recepción de una notificación de la ejecución de efectos como facturar, reservar stock o enviar correos.

Para crear intentos de pago, también conviene manejar los reintentos de tu propia aplicación de manera explícita: un timeout no siempre significa que la operación remota no se haya realizado.

Cuándo lo necesitás: antes de poner el flujo de pagos en producción. No es un producto adicional de Mercado Pago; es una propiedad de tu integración.

## 4. Reembolsos y cancelaciones

Prioridad alta

Problema: una compra fue pagada, pero tenés que devolver el dinero.

Ejemplos reales:

- El cliente devuelve un producto.
- El comercio cancela un pedido por falta de stock.
- Se detecta un cobro duplicado.
- El pedido no puede entregarse.
- El negocio decide devolver el importe como excepción comercial.

Mercado Pago contempla operaciones de reembolso y cancelación. En términos generales, el reembolso se aplica a un pago capturado, mientras que la cancelación se utiliza para operaciones que todavía no fueron aprobadas; los detalles dependen del flujo de pago.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.mercadopago.com.ar\&sz=32)

Mercado Pago Developers



### Ejemplo en tu e-commerce

```
Order: PAID
   |
   | Cliente devuelve el producto
   v
Solicitud de devolución
   |
   v
Validar política comercial
   |
   v
Solicitar reembolso a Mercado Pago
   |
   v
Confirmar el resultado de la operación
   |
   v
Registrar Refund
```

Podrías modelar una entidad interna `Refund`:

```
Refund:
  id
  orderId
  paymentId
  amount
  reason
  status
  providerRefundId
  createdAt
```

No necesariamente la necesitás como entidad de dominio independiente desde el día uno. Pero si manejás múltiples reembolsos parciales, auditoría o flujos de aprobación, empieza a tener mucho sentido.

### ¿Por qué no basta con cambiar la orden a `CANCELLED`?

Porque son dos operaciones diferentes:

- Tu e-commerce: cancela la compra como proceso comercial.
- Mercado Pago: procesa la cancelación o devolución financiera.

No deberías afirmar que se devolvió el dinero simplemente porque actualizaste el estado de tu orden.

Además, un reembolso parcial no implica necesariamente cancelar todo el pedido.

Cuándo lo necesitás: cuando tu tienda necesita administrar devoluciones y excepciones desde su propio backoffice.

Referencia: [Reembolsos y cancelaciones](https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/payment-management/refunds-cancellations?utm_source=chatgpt.com).&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.mercadopago.com.ar\&sz=32)

Mercado Pago Developers



## 5. Contracargos y disputas

Problema: el comprador desconoce una transacción ante su banco o emisor de la tarjeta.

Esto es distinto de un reembolso voluntario. En un contracargo, una compra puede haber sido aprobada y posteriormente entrar en disputa.

Mercado Pago ofrece notificaciones y operaciones para administrar contracargos, incluidas instancias en las que se solicita evidencia de la transacción.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.mercadopago.com.ar\&sz=32)

Mercado Pago Developers

+1



### Ejemplo

Un cliente compra una notebook, la recibe y luego desconoce el cargo. El comercio debe poder reconstruir qué sucedió:

- Qué pedido se realizó.
- Qué producto se vendió.
- Qué pago corresponde a la compra.
- Qué evidencia acredita el envío y la entrega.
- Qué comunicaciones hubo con el cliente.

Tu e-commerce debería conservar la trazabilidad de la operación y procesar las notificaciones de disputa.

Una estructura sencilla:

```
Payment
  |
  +--> Order
  +--> Shipment
  +--> Customer
  +--> Invoice
  |
  v
ChargebackCase
  ├── status
  ├── reason
  ├── evidence
  └── deadline
```

No hace falta implementar un sistema complejo de disputas para una primera versión de portfolio. Pero sí es útil conocer la diferencia y diseñar tus datos para que una operación pueda auditarse.

Cuándo lo necesitás: cuando administrás ventas reales y necesitás responder a disputas, o cuando tu proyecto quiere demostrar cómo se gestiona un ciclo de vida de pagos más allá del camino exitoso.

## 6. Configurar los medios de pago aceptados

Problema: no siempre querés ofrecer todas las opciones que permite tu integración.

Checkout Pro tiene configuraciones para excluir determinados medios de pago. Esto sirve cuando existe una decisión comercial concreta sobre cómo querés cobrar. ([Documentación de Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/additional-settings/payment-methods?utm_source=chatgpt.com))

### Ejemplos

- Tu e-commerce acepta tarjetas, pero no quiere ofrecer pagos en efectivo para ciertos productos digitales.
- Vendés un servicio que solo se habilita después de confirmar el pago y necesitás evitar opciones cuyo procesamiento no se adapte a esa regla.
- Creaste una campaña comercial para determinados medios de pago.
- Estás probando cómo cambia la conversión al ofrecer distintas alternativas.

El último caso merece cuidado: no conviene retirar métodos de pago arbitrariamente. Menos opciones pueden significar menos conversiones.

Cuándo lo necesitás: cuando exista un requisito comercial o una estrategia de conversión que justifique limitar las opciones. No es necesario para que tu checkout básico funcione.

## 7. Vencimiento de la preferencia y del checkout

Problema: el cliente crea un pedido, recibe el link y vuelve a pagar horas o días después, cuando el pedido cambió.

Supongamos que tenés una sola unidad de un producto:

```
10:00 — Pedido A: $100.000
10:01 — Se genera el init_point
10:10 — El precio cambia o el stock se agota
14:00 — El comprador intenta pagar
```

¿Qué hacés con esa preferencia antigua?

Mercado Pago permite configurar la fecha de vencimiento y la vigencia de las preferencias en Checkout Pro. ([Documentación de Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/additional-settings/expiration-date?utm_source=chatgpt.com))

Podrías establecer una política comercial como:

- Un link de pago de una compra normal vence después de cierto período.
- Una oferta promocional tiene un plazo limitado.
- Un presupuesto comercial debe abonarse antes de una fecha determinada.

Pero el vencimiento del checkout no resuelve por sí solo los problemas de inventario. Tu backend sigue necesitando controlar el stock, los precios y el estado de la orden.

Cuándo lo necesitás: cuando los pedidos o precios tienen vigencia limitada, o cuando querés evitar que una preferencia siga siendo utilizable indefinidamente.

## 8. Preferencias con múltiples productos, envío y datos de facturación

Estas capacidades siguen siendo parte de Checkout Pro. No tenés que implementar otro checkout para utilizarlas.

La documentación contempla preferencias con múltiples ítems, configuración de envío y descripción de factura. ([Documentación de Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/overview?utm_source=chatgpt.com))

### Ejemplo A: carrito con varios productos

El comprador lleva:

```
Teclado:       $50.000 x 1
Mouse:         $20.000 x 2
Monitor:      $300.000 x 1
Envío:         $10.000
-----------------------
Total:        $400.000
```

Tu backend construye la preferencia a partir del pedido validado. El importe no debería surgir directamente de datos arbitrarios enviados por el frontend: el backend debe calcular o verificar los precios que realmente corresponden.

### Ejemplo B: envío

Un cliente compra una notebook que debe enviarse a domicilio. Podés incluir la información que corresponda en la configuración del checkout, pero tu sistema de logística debe seguir siendo responsable de gestionar la preparación, el envío y la entrega.

### Ejemplo C: descripción del cobro

Una descripción reconocible en la operación puede ayudar al cliente a identificar por qué recibió ese cargo.

Cuándo lo necesitás: a medida que tu e-commerce pasa de una compra de un solo producto a un carrito real con cantidades, envío y mejores datos de operación.

## 9. Reportes, liquidaciones y conciliación

Prioridad alta para un sistema financiero

Problema: tu e-commerce dice que vendió $10 millones, pero ¿cuánto dinero recibió efectivamente tu cuenta de Mercado Pago?

No son lo mismo.

Imaginá estas cifras hipotéticas:

| Concepto                                     | Importe     |
| -------------------------------------------- | ----------- |
| Ventas aprobadas                             | $10.000.000 |
| Reembolsos                                   | -$300.000   |
| Comisiones y otros ajustes                   | -$250.000   |
| Saldo liquidado o disponible correspondiente | $9.450.000  |

Los importes son ilustrativos; la composición real depende de las comisiones, los plazos de liberación y las demás operaciones de tu cuenta.

Mercado Pago dispone de reportes de transacciones, movimientos de cuenta y liquidaciones para seguir el impacto financiero de las operaciones y conciliarlas con sistemas internos. ([Documentación de reportes](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/additional-content/reports/introduction?utm_source=chatgpt.com))

### ¿Qué problema soluciona?

Tu base de datos comercial responde preguntas como:

- ¿Cuántos pedidos se aprobaron?
- ¿Cuánto facturamos?
- ¿Qué compras fueron reembolsadas?

Los reportes financieros ayudan a responder otras:

- ¿Qué movimientos impactaron en el saldo?
- ¿Qué dinero fue liberado?
- ¿Qué operaciones todavía no cuadran con nuestros registros?

### Cómo lo modelaría en tu arquitectura

```
E-commerce
    |
    +--> Orders
    +--> Payments
    +--> Refunds
             |
             v
     Conciliación financiera
             |
             +--> Datos internos
             |
             +--> Reportes Mercado Pago
             |
             v
     Diferencias para investigar
```

No hace falta descargar reportes constantemente para un proyecto chico. Podés empezar con el backoffice de Mercado Pago y tus propios registros.

Cuando aumenta el volumen de operaciones, incorporás la conciliación programada, la descarga de reportes y la detección de diferencias.

Cuándo lo necesitás: cuando te importa la liquidez, la liquidación real y la contabilidad, no solamente el estado comercial de la compra.

Este tema es especialmente relevante para tu interés en ledger y sistemas de pagos: la conciliación no reemplaza un ledger propio, ni los reportes de Mercado Pago constituyen automáticamente tu libro contable interno.

## 10. Mejorar la aprobación de los pagos

Problema: muchos clientes llegan al checkout, pero sus pagos no terminan aprobados.

Tu primera reacción podría ser asumir que el problema es de código. En realidad, puede haber causas diferentes: restricciones del medio de pago, validaciones de seguridad, fondos insuficientes, datos incorrectos o decisiones del emisor.

Mercado Pago tiene documentación para investigar rechazos y mejorar la calidad de la integración. ([Guía de integración](https://www.mercadopago.com.ar/developers/es/docs/getting-started?utm_source=chatgpt.com))

### Ejemplo

De 1.000 intentos de pago:

- 700 se aprueban.
- 100 quedan pendientes.
- 200 se rechazan.

Tu sistema debería permitir investigar qué ocurre con esas categorías, sin contar cada intento como una venta aprobada.

Algunas métricas posibles:

```
payment_attempts_total
payment_approved_total
payment_pending_total
payment_rejected_total
payment_approval_rate
```

Podrías segmentarlas por fecha, medio de pago, importe y motivo de rechazo cuando esos datos estén disponibles.

Cuándo lo necesitás: cuando ya tenés un checkout operativo y querés mejorar conversiones, soporte y observabilidad. Es un paso más avanzado que simplemente conseguir que funcione el camino feliz.

# 3. Funcionalidades de pagos que se incorporan cuando cambia el negocio

Estas ya no son solamente configuraciones de tu preferencia: pueden requerir otro flujo de integración o un modelo de negocio diferente.

## 11. Suscripciones y cobros recurrentes

Problema: cada mes necesitás cobrarle al mismo cliente por un servicio.

Ejemplos:

- Una plataforma de cursos que cobra $15.000 mensuales.
- Un software SaaS con planes Básico, Pro y Enterprise.
- Un gimnasio con membresías.
- Un servicio de contenido premium.
- Una plataforma que realiza cobros semanales o anuales.

Podrías intentar generar manualmente una nueva preferencia cada mes, pero entonces tu sistema sería responsable de recordatorios, renovaciones y todo el ciclo de cobranza.

La solución de Suscripciones de Mercado Pago contempla cobros recurrentes automáticos, periodicidad configurable y reintentos de cobro según las condiciones de la solución. ([Documentación de Suscripciones](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/overview?utm_source=chatgpt.com))

### Ejemplo

```
Cliente
   |
   v
Contrata plan mensual
   |
   v
Se crea la suscripción
   |
   v
Mercado Pago gestiona el cobro recurrente
   |
   v
Tu sistema recibe el cambio de estado
   |
   v
Habilita o restringe el acceso al servicio
```

En tu dominio aparecerían conceptos nuevos:

```
Subscription
SubscriptionPlan
SubscriptionStatus
BillingPeriod
```

No los confundas con `Order` y `Payment`: la suscripción representa el acuerdo recurrente; cada cobro representa una operación financiera.

Cuándo lo necesitás: cuando cobrás periódicamente sin que el cliente tenga que iniciar manualmente cada pago. Para una tienda que vende productos aislados, no hace falta.

## 12. Checkout API: cuando no querés redirigir al comprador

Problema: querés que el cliente ingrese sus datos de pago dentro de tu propio sitio, sin abandonar tu checkout.

Checkout API está orientado a integrar el procesamiento de pagos en tu web o aplicación con mayor control sobre la experiencia. La documentación argentina presenta Orders API como la opción recomendada para nuevas integraciones de Checkout API, con procesamiento automático o manual según el flujo. ([Documentación de Checkout API](https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/overview?utm_source=chatgpt.com))

### Ejemplo

En vez de esto:

```
Mi sitio → Mercado Pago → Pagar → Mi sitio
```

Tenés una experiencia de checkout integrada en tu aplicación:

```
Mi sitio
   |
   v
Formulario de pago propio
   |
   v
Integración segura con Mercado Pago
   |
   v
Resultado de la operación
```

Esto no significa que tu backend deba recibir o guardar los datos de la tarjeta sin más. La tokenización, los SDK y las obligaciones de seguridad forman parte de la integración.

Cuándo lo necesitás: cuando la redirección limita la experiencia que querés ofrecer o necesitás capacidades que tu modalidad actual no cubre.

No migraría solo por aprender otra API. Primero haría sólido el flujo con Checkout Pro y después implementaría una segunda variante como ejercicio o por una necesidad real.

## 13. Checkout Bricks: componentes de pago listos para integrar

Checkout Bricks es una alternativa cuando querés personalizar más la experiencia que con la redirección de Checkout Pro, pero preferís utilizar componentes de interfaz preconstruidos.

La documentación describe distintas piezas, como Payment, Wallet y Card Payment, para necesidades de integración diferentes. ([Documentación de Bricks](https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/overview?utm_source=chatgpt.com))

### Ejemplo

Tu producto tiene un checkout propio con:

- Dirección de envío.
- Resumen del carrito.
- Aplicación de cupones.
- Selección del método de pago.
- Confirmación de compra.

Querés mantener el diseño de tu web y utilizar un componente de Mercado Pago para la parte de pago.

Bricks puede ser una alternativa a construir toda esa interfaz desde cero.

Cuándo lo necesitás: cuando tenés requerimientos de experiencia visual, conversión o integración que justifican una interfaz de pago más personalizada.

No necesitás Checkout API y Bricks solo porque ambos existan. Evaluás cuál resuelve mejor tu caso.

## 14. Marketplace y Split Payments: cobrar y distribuir el dinero

Cambio importante de modelo de negocio

Problema: tu plataforma conecta compradores con múltiples vendedores y debe distribuir el importe de una venta.

Este es uno de los casos donde se vuelve más interesante pensar en pagos como un sistema separado del e-commerce.

### Ejemplo

Imaginá un marketplace que vende productos de distintos comercios:

```
Comprador paga $100.000
          |
          v
    Mercado Pago
          |
          +------> Vendedor A
          |
          +------> Marketplace: comisión
```

En un modelo de Split Payments compatible, Mercado Pago distribuye importes entre participantes según la configuración del producto. La integración exige autorizaciones y credenciales adecuadas para los vendedores, entre otras condiciones. ([Documentación de Split Payments 1:1](https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/prerequisites?utm_source=chatgpt.com))

### Ejemplo más concreto

Vendés un producto de $100.000 de un vendedor externo y cobrás una comisión de plataforma del 10%.

Tu sistema comercial registra:

```
Order:
  total = 100000
  sellerId = seller-123
```

El split configura la distribución financiera correspondiente, de acuerdo con las condiciones habilitadas para la integración. No tenés que simular por tu cuenta una transferencia al vendedor simplemente porque el pedido quedó `PAID`.

### ¿Dónde aparece OAuth?

Si cada vendedor conecta su propia cuenta de Mercado Pago, tu plataforma no debería pedirle su contraseña ni utilizar indiscriminadamente una única credencial para todos.

OAuth permite que cada vendedor autorice el acceso de tu aplicación a los recursos permitidos de su cuenta. ([Documentación de OAuth](https://www.mercadopago.com.ar/developers/es/docs/security/oauth/introduction?utm_source=chatgpt.com))

Cuándo lo necesitás: cuando pasás de vender tus propios productos a operar una plataforma con vendedores independientes, comisiones y distribución de fondos.

Para tu portfolio, este sería un buen proyecto posterior a una integración de pagos sólida: obliga a resolver autorización por vendedor, correlación de operaciones, estados y conciliación.

## 15. Guardar tarjetas para futuras compras

Problema: el cliente compra habitualmente y querés reducir la fricción en los siguientes pagos.

Ejemplos:

- Un cliente compra todos los meses en tu tienda.
- Una empresa hace compras frecuentes desde una cuenta corporativa.
- Querés ofrecer una experiencia de pago que permita seleccionar un medio previamente guardado.

Pero hay una diferencia importante: Checkout Pro mediante Preferences API no debe confundirse con los flujos que permiten gestionar tarjetas guardadas. La documentación actual también incluye capacidades de tarjetas guardadas en el flujo de Checkout Pro vía Orders API y en otras modalidades. Tenés que verificar cuál soporta el escenario que querés implementar. ([Documentación de Checkout Pro vía Orders API](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/saved-cards?utm_source=chatgpt.com))

Además, una tarjeta guardada no significa que puedas cobrar sin autorización o ignorar las condiciones aplicables al uso de ese medio de pago.

Cuándo lo necesitás: cuando la recompra frecuente es importante para el negocio y los mecanismos soportados por tu integración permiten la experiencia deseada.

Para tu implementación actual, lo dejaría para después de tener correctamente resueltos los Webhooks y el ciclo de vida de los pagos.

## 16. Pagos presenciales mediante código QR

Problema: tu negocio vende tanto por Internet como en un local físico.

Ejemplo: una tienda tiene un e-commerce y un local en el que los clientes pagan desde una billetera mediante un QR.

Mercado Pago dispone de APIs para integrar pagos con QR y asociarlos con sucursales y cajas (puntos de venta). ([Documentación de QR](https://www.mercadopago.com.ar/developers/es/docs/qr-code/create-store-and-pos?utm_source=chatgpt.com))

Tu sistema podría verse así:

```
                  E-commerce
                      |
                 Checkout Pro
                      |
                      v
                 Backend común
                      ^
                      |
             Sistema de tienda
                      |
                  Pago QR
```

El backend común puede compartir productos, órdenes y clientes cuando la lógica de negocio lo permita. Sin embargo, el proceso de iniciar y confirmar un pago QR no es idéntico al flujo de creación de preferencias de Checkout Pro.

Cuándo lo necesitás: cuando tu sistema debe aceptar pagos presenciales por QR, además de pagos en la web.

No necesitás esta integración si tu portfolio solamente simula una tienda online.

## 17. Terminales Point integradas con el punto de venta

Problema: el vendedor usa una terminal de tarjeta, pero también necesita que su software registre la venta y conozca el resultado del pago.

Mercado Pago Point permite integrar terminales con el sistema de punto de venta para iniciar operaciones y recibir notificaciones sobre su estado. ([Documentación de Point](https://www.mercadopago.com.ar/developers/es/docs/mp-point/overview?utm_source=chatgpt.com))

### Ejemplo

Un empleado registra una venta en caja:

```
POS / Sistema de ventas
         |
         | Crear operación
         v
    Mercado Pago
         |
         v
    Terminal Point
         |
         v
Cliente paga con tarjeta
         |
         v
Notificación de resultado
         |
         v
POS actualiza la venta
```

Esta funcionalidad es diferente de aceptar tarjetas dentro de Checkout Pro. Acá hay una terminal física, una caja y una operación iniciada desde el punto de venta.

Cuándo lo necesitás: cuando el negocio tiene una tienda física y quiere integrar el cobro presencial con su software de gestión.

Para tu proyecto de e-commerce online, no es prioritario.

## 18. Links de pago para ventas que no pasan por tu carrito

Problema: querés cobrar una venta sin que el cliente tenga que navegar por el e-commerce y completar todo el flujo normal de compra.

Ejemplos:

- Un vendedor acuerda una compra por WhatsApp.
- Un cliente solicita un servicio personalizado.
- Un comercio vende un producto que no está publicado en la tienda.
- Un operador necesita solicitar el pago de una deuda o diferencia de precio.

Podrías tener un flujo como:

```
Operador o sistema comercial
          |
          v
Generar link de pago
          |
          v
Enviar al cliente
          |
          v
Cliente paga
          |
          v
Webhook y confirmación
          |
          v
Registrar pago en el sistema
```

Crear un link mediante tu backend usando Checkout Pro puede resolver parte de este escenario. Si necesitás links y administración comercial sin desarrollar toda una integración, también existen opciones de cobro desde la propia cuenta de Mercado Pago.

Cuándo lo necesitás: cuando tenés ventas asistidas o cobranzas fuera del checkout habitual.

No es un nuevo procesador de pagos ni significa que tengas que reemplazar Checkout Pro: es otra forma de iniciar el cobro.

## 19. Restringir compras a usuarios registrados

Problema: tu negocio necesita limitar quién puede completar la compra.

Ejemplos:

- Una tienda mayorista que opera con clientes registrados.
- Un portal privado para clientes corporativos.
- Una plataforma con productos disponibles únicamente para miembros.

Checkout Pro contempla una opción para restringir compras a usuarios registrados en los escenarios soportados por la integración. ([Documentación de Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/overview?utm_source=chatgpt.com))

Pero atención: hay dos conceptos distintos.

Autenticación en tu e-commerce: quién es el usuario de tu sistema y qué está autorizado a comprar.

Identificación en Mercado Pago: las condiciones bajo las que el comprador puede utilizar el checkout.

Tu backend debe aplicar sus propias reglas de autorización. No conviene asumir que porque Mercado Pago identifica al comprador, tu e-commerce ya conoce automáticamente su usuario interno.

Cuándo lo necesitás: cuando el negocio exige compras autenticadas o existen restricciones de acceso a productos. Una tienda pública normal no necesita implementarlo.

## 20. Ambientes de prueba, credenciales y seguridad de la integración

No es una funcionalidad visible para el comprador, pero es esencial para cualquier integración.

Tu sistema usa credenciales para comunicarse con Mercado Pago. La documentación distingue entre credenciales de prueba y producción, y recomienda mantenerlas protegidas. ([Buenas prácticas de credenciales](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/best-practices/credentials-best-practices/secure-credentials?utm_source=chatgpt.com))

### Ejemplo de configuración en NestJS

```
ConfigModule
   |
   v
MercadoPagoConfig
   |
   +--> Access Token
   +--> Environment
   +--> Webhook configuration
```

Las credenciales privadas deberían almacenarse en variables de entorno o en un gestor de secretos adecuado, nunca en el frontend ni en el repositorio.

Tu integración debería poder ejecutar pruebas de:

- Preferencia creada correctamente.
- Preferencia rechazada por datos inválidos.
- Timeout al crear una preferencia.
- Pago pendiente.
- Pago aprobado.
- Notificación duplicada.
- Reembolso.
- Evento recibido que no coincide con ningún pedido interno.

Cuándo lo necesitás: desde el principio. No es algo que agregás solamente al final, antes de publicar.

# 4. Otros conceptos importantes que no conviene confundir

No todas las funciones útiles para un sistema de pagos son productos separados de Mercado Pago.

## 21. Estados de pago y estados de pedido

Supongamos que un pedido está esperando el pago:

```
Order.status = PENDING_PAYMENT
Payment.status = PENDING
```

Luego el pago se aprueba:

```
Payment.status = APPROVED
```

Tu negocio puede decidir entonces marcar la orden como pagada:

```
Order.status = PAID
```

Pero tu `Payment` y tu `Order` deberían mantener sus responsabilidades propias. Un pedido puede tener varios intentos de pago, un pago fallido seguido de uno aprobado o un reembolso posterior.

Por eso, no usaría un único campo `status` para representar todas las dimensiones financieras y comerciales de una compra.

## 22. Múltiples intentos de pago

Un cliente tiene una compra de $80.000, intenta pagar con una tarjeta y el pago es rechazado. Luego prueba con otro medio.

El sistema tiene que distinguir los intentos:

```
Order #100
  |
  +--> PaymentAttempt #1: REJECTED
  |
  +--> PaymentAttempt #2: APPROVED
```

La segunda operación no debe crear una venta comercial completamente nueva si sigue correspondiendo al mismo pedido.

En tu modelo, podrías diferenciar entre `Payment` y `PaymentAttempt`, aunque no necesariamente debas introducir ambas entidades en la primera versión.

Cuándo lo necesitás: en cuanto permitís reintentar pagos y querés trazabilidad de por qué se aprobó o rechazó cada intento.

## 23. Reconciliación de eventos perdidos

Incluso con Webhooks, tu sistema debería tener una estrategia para investigar diferencias.

Por ejemplo:

- Un evento no pudo procesarse por una caída de la base de datos.
- La aplicación recibió una notificación, pero el proceso falló.
- Un registro interno quedó en `PENDING` durante demasiado tiempo.
- Un pago se actualizó en el proveedor, pero tu sistema todavía refleja un estado anterior.

Podés implementar una tarea programada que busque operaciones antiguas en estado pendiente, consulte el recurso externo cuando corresponda y repare inconsistencias de manera controlada.

No se trata de consultar constantemente todos los pagos. Se trata de tener un mecanismo de recuperación para casos anormales.

Cuándo lo necesitás: cuando querés robustez operacional y no depender de que todos los eventos se procesen perfectamente a la primera.

## 24. Reservar, capturar y cancelar fondos

En algunos modelos de integración, la aprobación y la captura pueden ser etapas separadas.

Esto importa cuando el negocio debe autorizar una operación, pero no confirmar definitivamente el cobro hasta que se cumpla una condición.

Ejemplo hipotético:

1. Un cliente solicita un producto.
2. El sistema verifica disponibilidad.
3. La operación entra en un flujo de autorización.
4. Se captura el importe cuando corresponde o se cancela la operación si no puede completarse.

No asumas que toda operación de Checkout Pro utiliza necesariamente este modelo: las operaciones disponibles dependen del flujo de integración elegido. La documentación de Checkout API vía Orders contempla gestión de fondos y operaciones relacionadas. ([Documentación de gestión de pagos](https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/overview?utm_source=chatgpt.com))

Cuándo lo necesitás: en negocios con autorización previa, captura posterior o requerimientos específicos del ciclo de pago. No lo agregaría a una compra sencilla solo por complejidad técnica.

# 5. ¿Qué aprendería primero en tu proyecto NestJS?

Para que esto no se convierta en una lista infinita de APIs que nunca terminás de implementar, seguiría este orden:

## 1

Completar el camino feliz

Crear la preferencia, guardar `preference_id` e `init_point`, asociar el checkout al `orderId` y redirigir al comprador.

Base

## 2

Confirmar correctamente los pagos

Webhooks, consulta del estado real, validación de importe e identidad, estados internos e idempotencia.

Imprescindible

## 3

Cubrir excepciones

Pagos pendientes, rechazados, reintentos, notificaciones duplicadas, caídas temporales y reembolsos.

Robustez

## 4

Observar y reconciliar

Logs estructurados, métricas, búsqueda de operaciones pendientes, conciliación y trazabilidad de pagos.

Producción

## 5

Ampliar el modelo de negocio

Recién después evaluaría suscripciones, marketplace y Split Payments, Checkout API, Bricks, QR o Point según el objetivo del siguiente proyecto.

Expansión

## Una aclaración importante sobre tu implementación actual

Vos estás trabajando con `CreatePreferenceUseCase` y el endpoint de creación de preferencias, `/checkout/preferences`. Ese flujo corresponde a Checkout Pro mediante Preferences API.

La documentación argentina de Mercado Pago también presenta una modalidad de Checkout Pro vía Orders API. Son caminos de integración distintos: no conviene mezclar sus contratos, identificadores y operaciones sin decidir explícitamente qué modalidad vas a utilizar. Podés consultar ambas en la [documentación oficial de Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/overview?utm_source=chatgpt.com) y la [documentación de Checkout Pro vía Orders API](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/overview?utm_source=chatgpt.com).

Para tu proyecto, no cambiaría de modalidad únicamente por tener más endpoints disponibles. Terminaría un flujo consistente y probado con la modalidad elegida y evaluaría la otra cuando tengas un requisito concreto.

## En definitiva

No necesitás aprender todas las APIs de Mercado Pago para ser capaz de implementar pagos correctamente.

Para tu backend, las competencias más importantes son entender el ciclo de vida del pago, integrar Webhooks, trabajar con idempotencia, distinguir la orden del pago, procesar devoluciones y resolver discrepancias financieras. Después, las demás funcionalidades se vuelven más fáciles de incorporar porque ya tenés las responsabilidades bien separadas.

La regla práctica es esta: cuando aparece un problema nuevo del negocio, buscás la funcionalidad de Mercado Pago que lo resuelve. No al revés: empezar por una API porque existe y después intentar justificar su uso.