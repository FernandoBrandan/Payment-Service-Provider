import { EntityId } from '@common/domain/vo/entity-id.vo'
import { ApiCredential } from '../../domain/api-credential.entity'
import { ApiCredentialOrmEntity } from './api-credential.orm.entity'

export class ApiCredentialMapper {
  static toDomain(orm: ApiCredentialOrmEntity): ApiCredential {
    return ApiCredential.reconstitute(
      EntityId.from(orm.id),
      EntityId.from(orm.apiClientId),
      orm.environment,
      orm.prefix,
      orm.keyHash,
      orm.status,
      orm.createdAt,
      orm.lastUsedAt,
      orm.revokedAt,
      orm.revokedReason,
    )
  }

  static toPersistence(domain: ApiCredential): Partial<ApiCredentialOrmEntity> {
    return {
      id: domain.id.value,
      apiClientId: domain.apiClientId.value,
      environment: domain.environment,
      prefix: domain.prefix,
      keyHash: domain.keyHash,
      status: domain.status,
      createdAt: domain.createdAt,
      lastUsedAt: domain.lastUsedAt,
      revokedAt: domain.revokedAt,
      revokedReason: domain.revokedReason,
    }
  }
}
