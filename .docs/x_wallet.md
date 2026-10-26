Un usuario puede tener múltiples billeteras (ej: una en USD, otra en ARS/MXN). Nunca guardes el saldo como un simple número que se actualiza constantemente sin registro.

    Wallet (Billetera)
        id (UUID)
        user_id (FK)
        currency (ISO 4217: USD, ARS, MXN, etc.)
        available_balance (Decimal/BigInt - dinero listo para usar)
        pending_balance (Decimal/BigInt - dinero retenido o en proceso)
        status (active, frozen, closed)
    BalanceHold (Retenciones de saldo)
        id (UUID)
        wallet_id (FK)
        amount (Decimal)
        reason (ej: "payment_reservation", "dispute")
        expires_at (Timestamp)

7.  Dominio de Comisiones (Fees)
    Cómo la plataforma (tu clon) gana dinero.

        Fee (Comisión cobrada)
            id (UUID)
            payment_id (FK)
            merchant_id (FK)
            amount (Decimal)
            percentage_applied (Decimal)
            type (processing_fee, withdrawal_fee, payout_fee)
            transaction_id (FK a Transaction - la transacción que acredita la plata en tu billetera maestra)

```
class Wallet implements AggregateRoot {
    private _balance: Money;
    private _pendingBalance: Money;
    private _status: WalletStatus;
    private _entries: LedgerEntry[]; // Solo las entradas recientes o paginadas

    constructor(id: WalletId, ownerId: UserId, currency: Currency) {
        this.id = id;
        this.ownerId = ownerId;
        this._balance = new Money(0, currency);
        this._pendingBalance = new Money(0, currency);
        this._status = WalletStatus.ACTIVE;
        this._entries = [];
    }

    // COMPORTAMIENTO: Depositar fondos
    deposit(amount: Money, referenceId: string): LedgerEntry {
        this.ensureIsActive();
        this.ensureSameCurrency(amount);

        this._balance = this._balance.add(amount);
        const entry = LedgerEntry.createCredit(this.id, amount, referenceId);
        this._entries.push(entry);

        this.recordDomainEvent(new FundsDeposited(this.id, amount));
        return entry;
    }

    // COMPORTAMIENTO: Retirar fondos
    withdraw(amount: Money, referenceId: string): LedgerEntry {
        this.ensureIsActive();
        this.ensureSameCurrency(amount);

        // INVARIANTE CRÍTICA: No se puede retirar más de lo disponible
        if (this._balance.isLessThan(amount)) {
            throw new InsufficientFundsException();
        }

        this._balance = this._balance.subtract(amount);
        const entry = LedgerEntry.createDebit(this.id, amount, referenceId);
        this._entries.push(entry);

        this.recordDomainEvent(new FundsWithdrawn(this.id, amount));
        return entry;
    }

    // INVARIANTES PRIVADAS
    private ensureIsActive() {
        if (this._status !== WalletStatus.ACTIVE) throw new WalletFrozenException();
    }
}
```

```
class TransferFundsService {
    constructor(
        private walletRepository: WalletRepository,
        private unitOfWork: UnitOfWork
    ) {}

    async execute(command: TransferCommand): Promise<void> {
        // 1. Cargar agregados
        const senderWallet = await this.walletRepository.findById(command.senderWalletId);
        const receiverWallet = await this.walletRepository.findById(command.receiverWalletId);

        // 2. Ejecutar comportamiento (Las entidades hacen su trabajo)
        const debitEntry = senderWallet.withdraw(command.amount, command.transferId);
        const creditEntry = receiverWallet.deposit(command.amount, command.transferId);

        // 3. Persistir en una sola transacción atómica (Unit of Work)
        await this.walletRepository.save(senderWallet);
        await this.walletRepository.save(receiverWallet);
        await this.unitOfWork.commit();
    }
}
```

```
// PUERTO: Definido en el Contexto de Pagos (o Kernel Compartido)
interface InternalFundsMoverPort {
    transferFunds(command: TransferFundsCommand): Promise<string>; // Retorna Ledger Transaction ID
}

// ADAPTADOR: Implementado en el Contexto de Ledger (Infraestructura/Aplicación)
class LedgerFundsMoverAdapter implements InternalFundsMoverPort {
    constructor(private ledgerService: LedgerApplicationService) {}

    async transferFunds(command: TransferFundsCommand): Promise<string> {
        // Traduce el comando del contexto de Pagos al Lenguaje Ubicuo del Ledger
        return this.ledgerService.executeP2PTransfer({
            fromAccount: command.sourceAccountId,
            toAccount: command.destinationAccountId,
            money: new Money(command.amount, command.currency),
            externalRef: command.referenceId
        });
    }
}
```
