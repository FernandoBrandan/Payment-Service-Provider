import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

// import { InfrastructureException } from '@common/exceptions/infrastructure.exception'

import { UserProfile } from '../../domain/user-profile.entity'
import { IUserProfileRepository } from '../../domain/repositories/user-profile.repository'
import { UserOrmEntity } from '../persistence/user.orm.entity'
import { UserMapper } from '../persistence/user.orm.mapper'

@Injectable()
export class TypeOrmUserRepository implements IUserProfileRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly ormRepo: Repository<UserOrmEntity>,
  ) {}

  async findById(id: string): Promise<UserProfile | null> {
    try {
      const orm = await this.ormRepo.findOne({ where: { id: id.toString() } })
      return orm ? UserMapper.toDomain(orm) : null
    } catch (error) {
      this.handleConnectionError(error)
    }
  }

  async findByUserId(userId: string): Promise<UserProfile | null> {
    try {
      const orm = await this.ormRepo.findOne({ where: { userId } })
      return orm ? UserMapper.toDomain(orm) : null
    } catch (error) {
      this.handleConnectionError(error)
    }
  }

  async save(UserProfile: UserProfile): Promise<void> {
    try {
      const entity = this.ormRepo.create(UserMapper.toPersistence(UserProfile))
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
      throw new Error('Database connection failed', error)
    }
    throw error
  }
}
