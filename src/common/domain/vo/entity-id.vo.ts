// pr_ledger/src/domain/vo/entity-id.vo.ts
import { randomUUID } from 'crypto'
import { InvalidEntityIdError } from '../errors'

export class EntityId {
  private constructor(public readonly value: string) {
    if (!value?.trim()) throw new InvalidEntityIdError()
  }

  static create(): EntityId {
    return new EntityId(randomUUID())
  }

  static from(value: string): EntityId {
    return new EntityId(value)
  }

  equals(other: EntityId): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}
