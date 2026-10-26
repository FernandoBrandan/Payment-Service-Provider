import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

// import { InfrastructureException } from '@common/exceptions/infrastructure.exception'

import { AuthUser } from '../../domain/auth-user.entity'
import { IAuthUserRepository } from '../../domain/repositories/auth-user.respository'
import { AuthUserOrmEntity } from '../persistence/auth-user.orm.entity'
import { AuthUserMapper } from '../persistence/auth-user.orm.mapper'

@Injectable()
export class TypeOrmAuthUserRepository implements IAuthUserRepository {
  constructor(
    @InjectRepository(AuthUserOrmEntity)
    private readonly ormRepo: Repository<AuthUserOrmEntity>,
  ) {}

  async findById(id: string): Promise<AuthUser | null> {
    try {
      const orm = await this.ormRepo.findOne({ where: { id: id.toString() } })
      return orm ? AuthUserMapper.toDomain(orm) : null
    } catch (error) {
      this.handleConnectionError(error)
    }
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    try {
      const orm = await this.ormRepo.findOne({ where: { email } })
      return orm ? AuthUserMapper.toDomain(orm) : null
    } catch (error) {
      this.handleConnectionError(error)
    }
  }

  async save(AuthUser: AuthUser): Promise<void> {
    try {
      const entity = this.ormRepo.create(AuthUserMapper.toPersistence(AuthUser))
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
