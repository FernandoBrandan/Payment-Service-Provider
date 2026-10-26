import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { EntityId } from '@common/domain/vo/entity-id.vo'
import {
  ApiCredential,
  ApiCredentialStatus,
  ApiEnvironment,
} from '../../domain/api-credential.entity'
import { IApiCredentialRepository } from '../../domain/repositories/api-credential.repository'
import { ApiCredentialOrmEntity } from '../persistence/api-credential.orm.entity'
import { ApiCredentialMapper } from '../persistence/api-credential.orm.mapper'

@Injectable()
export class TypeOrmApiCredentialRepository implements IApiCredentialRepository {
  constructor(
    @InjectRepository(ApiCredentialOrmEntity)
    private readonly ormRepo: Repository<ApiCredentialOrmEntity>,
  ) {}

  async findById(id: EntityId): Promise<ApiCredential | null> {
    try {
      const orm = await this.ormRepo.findOne({ where: { id: id.value } })
      return orm ? ApiCredentialMapper.toDomain(orm) : null
    } catch (error) {
      this.handleConnectionError(error)
    }
  }

  async findByPrefix(prefix: string): Promise<ApiCredential | null> {
    try {
      const orm = await this.ormRepo.findOne({ where: { prefix } })
      return orm ? ApiCredentialMapper.toDomain(orm) : null
    } catch (error) {
      this.handleConnectionError(error)
    }
  }

  async findByApiClientId(apiClientId: EntityId): Promise<ApiCredential[]> {
    try {
      const rows = await this.ormRepo.find({
        where: { apiClientId: apiClientId.value },
        order: { createdAt: 'DESC' },
      })
      return rows.map(ApiCredentialMapper.toDomain)
    } catch (error) {
      this.handleConnectionError(error)
    }
  }

  async findActiveByApiClientAndEnv(
    apiClientId: EntityId,
    environment: ApiEnvironment,
  ): Promise<ApiCredential | null> {
    try {
      const orm = await this.ormRepo.findOne({
        where: { apiClientId: apiClientId.value, environment, status: ApiCredentialStatus.ACTIVE },
      })
      return orm ? ApiCredentialMapper.toDomain(orm) : null
    } catch (error) {
      this.handleConnectionError(error)
    }
  }

  async save(credential: ApiCredential): Promise<void> {
    try {
      const entity = this.ormRepo.create(ApiCredentialMapper.toPersistence(credential))
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
