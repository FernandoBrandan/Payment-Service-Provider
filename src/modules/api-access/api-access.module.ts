// src/modules/api-access/api-access.module.ts
import { forwardRef, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { API_CLIENT_REPOSITORY, API_CREDENTIAL_REPOSITORY } from '@infra/tokens'
import { AuthInfraModule } from '@infra/auth-infra/auth-infra.module'
import { ApiKeyGuard } from '@infra/guards/api-key.guard'

import { ApiClientOrmEntity } from './infrastructure/persistence/api-client.orm.entity'
import { ApiCredentialOrmEntity } from './infrastructure/persistence/api-credential.orm.entity'

import { TypeOrmApiClientRepository } from './infrastructure/repositories/typeorm-api-client.repository'
import { TypeOrmApiCredentialRepository } from './infrastructure/repositories/typeorm-api-credential.repository'

import { AuthenticateApiKeyUseCase } from './application/use-cases/authenticate-api-key.use-case'
import { CreateApiClientUseCase } from './application/use-cases/create-api-client.use-case'
import { IssueApiCredentialUseCase } from './application/use-cases/issue-api-credential.use-case'
import { RevokeApiKeyUseCase } from './application/use-cases/revoke-api-key.use-case'

import { AdminApiClientsController } from './presentation/admin-api-clients.controller'
import { ApiCredentialsController } from './presentation/api-credentials.controller'

import { IdentityModule } from '../identity/identity.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiClientOrmEntity, ApiCredentialOrmEntity]),
    forwardRef(() => IdentityModule),
    AuthInfraModule, // provee AuthGuard + RolesGuard (usados por @Auth en el admin controller)
  ],
  controllers: [AdminApiClientsController, ApiCredentialsController],
  providers: [
    AuthenticateApiKeyUseCase,
    CreateApiClientUseCase,
    IssueApiCredentialUseCase,
    RevokeApiKeyUseCase,
    ApiKeyGuard, // depende de AuthenticateApiKeyUseCase (mismo módulo)
    { provide: API_CLIENT_REPOSITORY, useClass: TypeOrmApiClientRepository },
    { provide: API_CREDENTIAL_REPOSITORY, useClass: TypeOrmApiCredentialRepository },
  ],
  exports: [
    API_CLIENT_REPOSITORY,
    API_CREDENTIAL_REPOSITORY,
    AuthenticateApiKeyUseCase,
    CreateApiClientUseCase,
    IssueApiCredentialUseCase,
    RevokeApiKeyUseCase,
  ],
})
export class ApiAccessModule {}
