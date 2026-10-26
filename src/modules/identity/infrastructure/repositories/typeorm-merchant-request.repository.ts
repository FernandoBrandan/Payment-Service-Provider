import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { MerchantRequest } from '../../domain/merchant-request.entity'
import { IMerchantProfileRequestRepository } from '../../domain/repositories/merchant-profile-request.repository'
import { MerchantRequestOrmEntity } from '../persistence/merchant-request.orm.entity'
import { MerchantRequestMapper } from '../persistence/merchant-request.orm.mapper'

@Injectable()
export class TypeOrmMerchantRequestRepository implements IMerchantProfileRequestRepository {
  constructor(
    @InjectRepository(MerchantRequestOrmEntity)
    private readonly ormRepo: Repository<MerchantRequestOrmEntity>,
  ) {}

  async findById(id: string): Promise<MerchantRequest | null> {
    try {
      const orm = await this.ormRepo.findOne({ where: { id } })
      return orm ? MerchantRequestMapper.toDomain(orm) : null
    } catch (error) {
      this.handleConnectionError(error)
    }
  }

  async save(request: MerchantRequest): Promise<void> {
    try {
      const entity = this.ormRepo.create(MerchantRequestMapper.toPersistence(request))
      await this.ormRepo.save(entity)
    } catch (error) {
      this.handleConnectionError(error)
    }
  }

  private handleConnectionError(error: any): never {
    const isConnectionError =
      error.code === 'ECONNREFUSED' ||
      error.message?.includes('connect ETIMEDOUT') ||
      error.message?.includes('Connection terminated') ||
      error.message?.includes('Connection lost')

    if (isConnectionError) {
      throw new Error('Database connection failed', { cause: error })
    }
    throw error
  }
}
