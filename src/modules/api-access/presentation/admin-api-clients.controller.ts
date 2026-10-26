// // admin-api-clients.controller.ts
// @Controller('/v1/admin/api-clients')
// @UseGuards(AdminGuard) // guard de admin (JWT de dashboard, no API key)
// export class AdminApiClientsController {
//   constructor(private readonly createApiClient: CreateApiClientUseCase) {}

//   @Post()
//   async create(
//     @Body()
//     body: {
//       merchantProfileId: string;
//       name?: string;
//       technicalEmail: string;
//     },
//     @Req() req: { user: { id: string; role: 'admin' } },
//   ) {
//     const result = await this.createApiClient.execute({
//       merchantProfileId: body.merchantProfileId,
//       name: body.name ?? null,
//       technicalEmail: body.technicalEmail,
//       createdByUserId: req.user.id,
//       createdByRole: 'admin',
//     });

//     return {
//       apiClientId: result.apiClient.id.value,
//       merchantProfileId: result.apiClient.merchantProfileId,
//       name: result.apiClient.name,
//       email: result.apiClient.email,
//       status: result.apiClient.status,
//       createdAt: result.apiClient.createdAt,
//       created: result.created, // ← idempotencia expuesta
//     };
//   }
// }

// src/modules/api-access/presentation/admin-api-clients.controller.ts
import { Body, Controller, Post } from '@nestjs/common'

import { Auth } from '@infra/auth-infra/decorators/auth.decorator'
import { CurrentUser } from '@infra/auth-infra/decorators/current-user.decorator'

import { UserRole } from '../../identity/domain/enums'

import { CreateApiClientUseCase } from '../application/use-cases/create-api-client.use-case'
import { CreateApiClientRequestDTO } from '../application/dto/request/create-api-client.request.dto'

@Controller('v1/admin/api-clients')
export class AdminApiClientsController {
  constructor(private readonly createApiClient: CreateApiClientUseCase) {}

  @Post()
  @Auth(UserRole.ADMIN)
  async create(@Body() body: CreateApiClientRequestDTO, @CurrentUser('sub') adminId: string) {
    const { apiClient, created } = await this.createApiClient.execute({
      merchantProfileId: body.merchantProfileId,
      name: body.name ?? null,
      technicalEmail: body.technicalEmail,
      createdByUserId: adminId,
    })

    return {
      apiClientId: apiClient.id.value,
      merchantProfileId: apiClient.merchantProfileId.value,
      name: apiClient.name,
      email: apiClient.email,
      status: apiClient.status,
      createdAt: apiClient.createdAt,
      created,
    }
  }
}
