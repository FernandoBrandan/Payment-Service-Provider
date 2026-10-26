import { InvalidCurrencyCodeError } from '../errors'

export class Currency {
  private static readonly CODE_REGEX = /^[A-Z]{3}$/

  private constructor(public readonly code: string) {
    if (!Currency.CODE_REGEX.test(code)) throw new InvalidCurrencyCodeError(code)
  }

  static from(code: string): Currency {
    return new Currency(code.trim().toUpperCase())
  }

  static readonly USD = new Currency('USD')
  static readonly EUR = new Currency('EUR')
  static readonly MXN = new Currency('MXN')
  static readonly ARS = new Currency('ARS')
  static readonly COP = new Currency('COP')

  /**
   * MVP: ARS y USD usan 2 decimales.
   * Si algún día se suma JPY (0) o KWD (3), este método es el único punto a tocar.
   */
  getMinorUnitScale(): number {
    return 2
  }

  equals(other: Currency): boolean {
    return this.code === other.code
  }

  toString(): string {
    return this.code
  }
}
