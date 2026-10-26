// modules/api-access/domain/repositories/api-client.repository.ts
import { EntityId } from '@common/domain/vo/entity-id.vo'
import { ApiClient } from './../api-client.entity'

export interface IApiClientRepository {
  findById(id: EntityId): Promise<ApiClient | null>
  /** Unique por merchant. Devuelve null si no existe. */
  findByMerchantId(merchantProfileId: EntityId): Promise<ApiClient | null>
  save(credential: ApiClient): Promise<void>
}

/*
**Importante**: agregar unique constraint en DB:

```sql
CREATE UNIQUE INDEX uq_api_client_merchant
  ON api_clients (merchant_profile_id)
  WHERE status <> 'deleted'; -- si algún día agregás soft delete
```

Sin este índice, dos requests concurrentes pueden pasar el `findByMerchantId` y crear dos clients.
El index te salva.
En el repo, el `save` debe traducir la violación de unique a un conflicto recuperable (re-fetch y devolver el existente).
*/
