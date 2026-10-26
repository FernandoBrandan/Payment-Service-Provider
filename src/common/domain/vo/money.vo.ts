// modules/payments/domain/vo/money.vo.ts
import Decimal from 'decimal.js'
import { Currency } from './currency.vo'
import { CurrencyMismatchError, InvalidMoneyPrecisionError } from '../errors'

export interface IMoney {
  readonly amount: Decimal
  readonly currency: Currency

  add(other: Money): Money
  subtract(other: Money): Money
  isZero(): boolean
  isPositive(): boolean
  isNegative(): boolean
  equals(other: Money): boolean
  toMinorUnitsString(): string
  toDecimalString(): string
  toString(): string
}

export class Money implements IMoney {
  private constructor(
    /** Unidad mayor (e.g. 100.50 = ARS 100,50). NO es minor units. */
    public readonly amount: Decimal,
    public readonly currency: Currency,
  ) {}

  static of(amount: number | string | Decimal, currency: Currency): Money {
    return new Money(new Decimal(amount), currency)
  }

  static zero(currency: Currency): Money {
    return new Money(new Decimal(0), currency)
  }

  /**
   * Construye desde minor units (e.g. centavos). Inverso de `toMinorUnitsString`.
   * @example Money.fromMinorUnits("10050", Currency.ARS) // ARS 100,50
   */
  static fromMinorUnits(minorUnits: string | number | Decimal, currency: Currency): Money {
    const scale = currency.getMinorUnitScale()
    const divisor = new Decimal(10).pow(scale)
    return new Money(new Decimal(minorUnits).dividedBy(divisor), currency)
  }

  add(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(this.amount.plus(other.amount), this.currency)
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(this.amount.minus(other.amount), this.currency)
  }

  isZero(): boolean {
    return this.amount.isZero()
  }

  isPositive(): boolean {
    return this.amount.isPositive()
  }

  isNegative(): boolean {
    return this.amount.isNegative()
  }

  equals(other: Money): boolean {
    return this.currency.equals(other.currency) && this.amount.equals(other.amount)
  }

  /**
   * Formato wire: string entero en la unidad menor de la moneda.
   *   ARS 100,50  -> "10050"
   *   USD   0,01  -> "1"
   * Lanza si el monto tiene más decimales de los que la moneda admite
   * (e.g. ARS 100,555 no es representable).
   */
  toMinorUnitsString(): string {
    const scale = this.currency.getMinorUnitScale()
    const minor = this.amount.times(new Decimal(10).pow(scale))

    if (!minor.isInteger()) {
      throw new InvalidMoneyPrecisionError(
        `Amount ${this.amount.toString()} ${this.currency.code} exceeds ${scale} decimal place(s)`,
      )
    }

    // toFixed(0) evita notación exponencial en montos grandes.
    return minor.toFixed(0)
  }

  /**
   * String decimal con la escala de la moneda, para display.
   *   ARS 100,5 -> "100.50"
   *   USD 0,1   -> "0.10"
   */
  toDecimalString(): string {
    return this.amount.toFixed(this.currency.getMinorUnitScale())
  }

  toString(): string {
    return `${this.toDecimalString()} ${this.currency}`
  }

  multiply(factor: number | string | Decimal): Money {
    return new Money(this.amount.times(factor), this.currency)
  }

  toNumber(): number {
    return this.amount.toNumber()
  }

  private assertSameCurrency(other: Money): void {
    if (!this.currency.equals(other.currency)) throw new CurrencyMismatchError()
  }
}
