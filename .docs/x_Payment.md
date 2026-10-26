## Dominio de Métodos de Pago (Payment Methods)

Aquí guardas los tokens de las tarjetas o cuentas bancarias (NUNCA guardes el CVV o el número completo de la tarjeta).

- PaymentMethod (Método de pago genérico)
- - id (UUID)
- - user_id (FK)
- - type (credit_card, debit_card, bank_account, cash_provider)
- - token (String - token devuelto por la pasarela real como Stripe/Adyen)
- - is_default (Boolean)
- CardDetails (Detalles de tarjeta)
- - payment_method_id (FK)
- - brand (visa, mastercard, amex)
- - last_four_digits
- - expiration_month, expiration_year
- - cardholder_name
- BankAccountDetails (Cuentas bancarias para retiros/debitos)
- - payment_method_id (FK)
- - bank_name
- - account_number, branch_number
- - account_type (checking, savings)
- - cbu_iban_clabe (identificador bancario local)

## Objetos de Valor (Value Objects - VOs)

```
// VO: Representa dinero. NUNCA uses primitivos (float/int) para dinero.
class Money {
    constructor(
        public readonly amount: Decimal, // Usar librerías de precisión arbitraria
        public readonly currency: Currency // ISO 4217 (USD, ARS, MXN)
    ) {}

    add(other: Money): Money { /* validar misma moneda, retornar nuevo Money */ }
    subtract(other: Money): Money { /* validar misma moneda, retornar nuevo Money */ }
    isGreaterThan(other: Money): boolean { ... }
    isZero(): boolean { ... }
}

// VO: Detalles de una tarjeta (Tokenizada, nunca el número real)
class CardToken {
    constructor(
        public readonly token: string,
        public readonly brand: CardBrand, // VISA, MASTERCARD
        public readonly lastFourDigits: string,
        public readonly expiration: ExpirationDate
    ) {}
}

// VO: Identificación fiscal
class TaxId {
    constructor(
        public readonly type: TaxIdType, // DNI, CUIT, RUT, RFC
        public readonly number: string
    ) {
        // Invariante: Validar formato del número según el tipo
    }
}
```

```

//
//
//
//
//
//
//
//
//
//

// VO: Detalles de enrutamiento interno.
// Si el PaymentReference es genérico, este VO extrae/define los datos específicos para la billetera interna.
class InternalRoutingDetails {
  constructor(
    public readonly sourceAccountId: string, // ID de la cuenta de origen en el Ledger
    public readonly destinationAccountId: string, // ID de la cuenta de destino en el Ledger
    public readonly destinationAliasOrCvu?: string, // Alias/CVU para trazabilidad humana (opcional)
  ) {
    // Invariante: Las cuentas no pueden ser iguales (no se puede pagar a uno mismo con este provider)
    if (sourceAccountId === destinationAccountId) {
      // throw new InvalidRoutingException("Source and destination accounts cannot be the same");
      throw new Error("Source and destination accounts cannot be the same");
    }
  }
}
// VO: El comando inmutable que el Provider enviará a través del puerto al contexto de Ledger.
class InternalLedgerTransferCommand {
  constructor(
    public readonly paymentId: string, // Para idempotencia en el Ledger
    public readonly routing: InternalRoutingDetails,
    public readonly amount: Money, // Tu VO de dinero
    public readonly description: string,
  ) {}
}

// ## PUERTO: El contrato que el Contexto de Pagos exige.
// No le importa cómo lo implemente el Ledger, solo qué datos necesita.
interface LedgerFundsMoverPort {
  transferFunds(command: TransferFundsDTO): Promise<string>; // Retorna el ID de la transacción del ledger
}
interface TransferFundsDTO {
  paymentId: string; // Para idempotencia
  sourceAccountId: string; // Cuenta origen (Ledger)
  destinationAccountId: string; // Cuenta destino (Ledger)
  amountInCents: number; // Dinero en centavos (primitivo simple)
  currency: string; // ISO code (ej: 'USD')
}

//
//
//
//
// Entidad: Reglas y límites específicos para pagos entre billeteras internas.
// Esta entidad SÍ se persiste si las reglas son configurables por admin, o puede ser un VO si son hardcodeadas.

class InternalWalletPolicy implements Entity {
  constructor(
    public readonly id: string,
    public readonly maxDailyTransferAmount: Money,
    public readonly maxSingleTransferAmount: Money,
    public readonly requiresKycForAmount: Money, // Si el pago supera esto, exige KYC validado
    public readonly allowedOperatingHours: TimeWindow, // Ej: 00:00 a 23:59 o restringido a horas hábiles
  ) {}

  // COMPORTAMIENTO: Validar si el pago cumple las reglas del provider interno
  validateTransfer(payerKycStatus: KycStatus, amount: Money, currentDailyVolume: Money): void {
    if (amount.isGreaterThan(this.maxSingleTransferAmount)) {
      throw new LimitExceededException("Amount exceeds single transfer limit");
    }

    if (currentDailyVolume.add(amount).isGreaterThan(this.maxDailyTransferAmount)) {
      throw new LimitExceededException("Amount exceeds daily transfer limit");
    }

    if (amount.isGreaterThan(this.requiresKycForAmount) && payerKycStatus !== KycStatus.APPROVED) {
      throw new KycRequiredException("KYC approval required for this amount");
    }
  }
}

// Servicio de Dominio (Implementa tu interfaz PaymentProvider)
// Este es el "cerebro" que usa tus entidades existentes (Payment, PaymentReference) junto con los objetos nuevos para ejecutar la acción.
class InternalWalletProvider implements PaymentProvider {
  constructor(
    private readonly policyRepository: InternalWalletPolicyRepository,
    private readonly accountMapper: UserToAccountMapperPort, // Puerto para traducir UserId -> AccountId
    private readonly ledgerPort: LedgerFundsMoverPort, // Puerto para hablar con el Ledger
  ) {}

  // El método principal que recibe tu entidad Payment existente
  async processPayment(payment: Payment, reference: PaymentReference): Promise<PaymentResult> {
    // 1. Obtener la política de límites (Entidad de dominio)
    const policy = await this.policyRepository.getActivePolicy();

    // 2. Mapear usuarios a cuentas del Ledger (usando el Payment y el Reference)
    const sourceAccountId = await this.accountMapper.getAccountId(payment.payerId);

    // Asumimos que el PaymentReference contiene el ID del comercio/usuario destino
    const destinationAccountId = await this.accountMapper.getAccountId(reference.targetUserId);

    const routing = new InternalRoutingDetails(sourceAccountId, destinationAccountId);

    // 3. Validar reglas de negocio del provider interno (Límites, KYC, etc.)
    const payerKyc = await this.getKycStatus(payment.payerId);
    const currentDailyVolume = await this.getDailyVolume(payment.payerId);

    policy.validateTransfer(payerKyc, payment.amount, currentDailyVolume);

    // 4. Construir el comando para el Ledger
    const command = new InternalLedgerTransferCommand(payment.id, routing, payment.amount, `Internal transfer for Payment ${payment.id}`);

    try {
      // 5. Ejecutar el movimiento en el Ledger a través del puerto (Anti-Corruption Layer)
      const ledgerTransactionId = await this.ledgerPort.transferFunds(command);

      // 6. Éxito: Retornar el resultado para que la entidad Payment cambie su estado
      return PaymentResult.success(ledgerTransactionId);
    } catch (error) {
      if (error instanceof InsufficientFundsException) {
        return PaymentResult.failed("Insufficient internal funds");
      }
      throw error; // Otros errores se propagan
    }
  }

  // ... métodos auxiliares privados (getKycStatus, getDailyVolume, etc.)
}



```

```

class ProcessInternalPaymentUseCase {
constructor(
private readonly paymentRepository: PaymentRepository,
private readonly ledgerPort: LedgerFundsMoverPort, // Inyección del puerto
private readonly accountMapper: UserToAccountMapperPort // Puerto para mapear User -> Account
) {}

    async execute(paymentId: string): Promise<void> {
        // 1. Cargar la Entidad de Dominio real (Payment)
        const payment = await this.paymentRepository.findById(paymentId);
        if (!payment) throw new Error("Payment not found");

        // La propia entidad Payment valida su estado (Comportamiento rico)
        if (!payment.canBeProcessed()) {
            throw new Error(`Payment is in invalid state: ${payment.status}`);
        }

        // 2. Mapear usuarios a cuentas del Ledger (usando primitivos/DTOs)
        const sourceAccountId = await this.accountMapper.getAccountId(payment.payerId);
        const destAccountId = await this.accountMapper.getAccountId(payment.receiverId);

        // 3. Armar el DTO (El "molde" simple)
        const transferCommand: TransferFundsDTO = {
            paymentId: payment.id,
            sourceAccountId: sourceAccountId,
            destinationAccountId: destAccountId,
            amountInCents: payment.amount.cents, // Accedemos a la primitiva del VO Money
            currency: payment.amount.currency.code
        };

        // 4. Llamar al Ledger a través de la Interfaz
        const ledgerTxId = await this.ledgerPort.transferFunds(transferCommand);

        // 5. Actualizar la Entidad de Dominio (Comportamiento rico)
        payment.markAsApproved(ledgerTxId);

        // 6. Persistir
        await this.paymentRepository.save(payment);
    }

}

```

```

```
