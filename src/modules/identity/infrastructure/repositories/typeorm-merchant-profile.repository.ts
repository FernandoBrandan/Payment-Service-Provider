import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { MerchantProfile } from '../../domain/merchant-profile.entity'
import { IMerchantProfileRepository } from '../../domain/repositories/merchant-profile.repository'
import { MerchantProfileOrmEntity } from '../persistence/merchant-profile.orm.entity'
import { MerchantProfileMapper } from '../persistence/merchant-profile.orm.mapper'

@Injectable()
export class TypeOrmMerchantProfileRepository implements IMerchantProfileRepository {
  constructor(
    @InjectRepository(MerchantProfileOrmEntity)
    private readonly ormRepo: Repository<MerchantProfileOrmEntity>,
  ) {}

  async findById(id: string): Promise<MerchantProfile | null> {
    try {
      const orm = await this.ormRepo.findOne({ where: { id } })
      return orm ? MerchantProfileMapper.toDomain(orm) : null
    } catch (error) {
      this.handleConnectionError(error)
    }
  }

  async save(profile: MerchantProfile): Promise<void> {
    try {
      const entity = this.ormRepo.create(MerchantProfileMapper.toPersistence(profile))
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
