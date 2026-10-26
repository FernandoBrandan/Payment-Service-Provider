// modules/api-access/domain/repositories/api-credential.repository.ts
import { EntityId } from '@common/domain/vo/entity-id.vo'
import { ApiCredential, ApiEnvironment } from '../api-credential.entity'

export interface IApiCredentialRepository {
  findById(id: EntityId): Promise<ApiCredential | null>
  findByPrefix(prefix: string): Promise<ApiCredential | null>
  findByApiClientId(apiClientId: EntityId): Promise<ApiCredential[]>
  findActiveByApiClientAndEnv(
    apiClientId: EntityId,
    environment: ApiEnvironment,
  ): Promise<ApiCredential | null>
  save(credential: ApiCredential): Promise<void>
}
