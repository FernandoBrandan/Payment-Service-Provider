import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { EntityId } from '@common/domain/vo/entity-id.vo'
import { ApiClient } from '../../domain/api-client.entity'
import { IApiClientRepository } from '../../domain/repositories/api-client.repository'
import { ApiClientOrmEntity } from '../persistence/api-client.orm.entity'
import { ApiClientMapper } from '../persistence/api-client.orm.mapper'

@Injectable()
export class TypeOrmApiClientRepository implements IApiClientRepository {
  constructor(
    @InjectRepository(ApiClientOrmEntity)
    private readonly ormRepo: Repository<ApiClientOrmEntity>,
  ) {}

  async findById(id: EntityId): Promise<ApiClient | null> {
    try {
      const orm = await this.ormRepo.findOne({ where: { id: id.value } })
      return orm ? ApiClientMapper.toDomain(orm) : null
    } catch (error) {
      this.handleConnectionError(error)
    }
  }

  async findByMerchantId(merchantProfileId: EntityId): Promise<ApiClient | null> {
    try {
      const orm = await this.ormRepo.findOne({
        where: { merchantProfileId: merchantProfileId.value },
      })
      return orm ? ApiClientMapper.toDomain(orm) : null
    } catch (error) {
      this.handleConnectionError(error)
    }
  }

  async save(apiClient: ApiClient): Promise<void> {
    try {
      const entity = this.ormRepo.create(ApiClientMapper.toPersistence(apiClient))
      await this.ormRepo.save(entity)
    } catch (error) {
      this.handleConnectionError(error)
    }
  }

  private handleConnectionError(error: any): never {
    const isConnectionError =
      error?.code === 'ECONNREFUSED' ||
      error?.message?.includes('connect ETIMEDOUT') ||
      error?.message?.includes('Connection terminated') ||
      error?.message?.includes('Connection lost')

    if (isConnectionError) {
      throw new Error('Database connection failed', { cause: error })
    }
    throw error
  }
}

// Importante — unique constraint:
// el índice único en merchantProfileId es lo que evita la carrera de CreateApiClientUseCase.
// Cuando save() viola unique, hoy el repo propaga el QueryFailedError (code 23505 en PG).
// El use case ya lo captura (err.code === '23505' || err.errno === 1062) para re-fetchear — pero ojo:
// en Postgres err.errno no existe, es err.code === '23505'.
// En MySQL es err.errno === 1062.
// El snippet del use case ya cubre ambos.
