import { forwardRef, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import {
  AUTH_USER_REPOSITORY,
  MERCHANT_PROFILE_REPOSITORY,
  MERCHANT_REQUEST_REPOSITORY,
  USER_PROFILE_REPOSITORY,
} from '@infra/tokens'
import { AuthInfraModule } from '@infra/auth-infra/auth-infra.module'

import { AuthUserOrmEntity } from './infrastructure/persistence/auth-user.orm.entity'
import { UserOrmEntity } from './infrastructure/persistence/user.orm.entity'
import { MerchantProfileOrmEntity } from './infrastructure/persistence/merchant-profile.orm.entity'
import { MerchantRequestOrmEntity } from './infrastructure/persistence/merchant-request.orm.entity'

import { TypeOrmAuthUserRepository } from './infrastructure/repositories/typeorm-auth-user.repository'
import { TypeOrmUserRepository } from './infrastructure/repositories/typeorm-user.repository'
import { TypeOrmMerchantProfileRepository } from './infrastructure/repositories/typeorm-merchant-profile.repository'
import { TypeOrmMerchantRequestRepository } from './infrastructure/repositories/typeorm-merchant-request.repository'

import { ApproveMerchantUseCase } from './application/use-cases/approve-merchant-request.use-case'
import { RequestMerchantRoleUseCase } from './application/use-cases/request-merchant-role.use-case'
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case'
import { AuthenticateUserUseCase } from './application/use-cases/authenticate-user.use-case'
import { GetProfileUseCase } from './application/use-cases/get-profile.use-case'
import { RefreshUseCase } from './application/use-cases/refresh.use-case'

import { AuthController } from './presentation/auth.controller'
import { UsersController } from './presentation/users.controller'

import { ApiAccessModule } from '../api-access/api-access.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuthUserOrmEntity,
      UserOrmEntity,
      MerchantProfileOrmEntity,
      MerchantRequestOrmEntity,
    ]),
    forwardRef(() => ApiAccessModule),
    AuthInfraModule,
  ],
  controllers: [AuthController, UsersController],
  providers: [
    RegisterUserUseCase,
    AuthenticateUserUseCase,
    RefreshUseCase,
    GetProfileUseCase,
    RequestMerchantRoleUseCase,
    ApproveMerchantUseCase,
    { provide: AUTH_USER_REPOSITORY, useClass: TypeOrmAuthUserRepository },
    { provide: USER_PROFILE_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: MERCHANT_PROFILE_REPOSITORY, useClass: TypeOrmMerchantProfileRepository },
    { provide: MERCHANT_REQUEST_REPOSITORY, useClass: TypeOrmMerchantRequestRepository },
  ],
  exports: [
    AUTH_USER_REPOSITORY,
    USER_PROFILE_REPOSITORY,
    MERCHANT_PROFILE_REPOSITORY,
    MERCHANT_REQUEST_REPOSITORY,
  ],
})
export class IdentityModule {}
