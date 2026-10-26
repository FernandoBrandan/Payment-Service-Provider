/* // api-credentials.controller.ts

@Controller("/v1/api-credentials")
@UseGuards(ApiKeyGuard) // el merchant tiene que estar autenticado con SU key
export class ApiCredentialsController {
  constructor(private readonly revoke: RevokeApiKeyUseCase) {}

  @Delete(":id")
  async revokeKey(
    @Param("id") credentialId: string,
    @Body() body: { reason: string },
    @Req() req: { apiAuth: ApiAuthContext },
  ) {
    // El merchant autenticado solo puede revocar keys de su propio client.
    const result = await this.revoke.execute({
      credentialId,
      reason: body.reason,
      revokedByUserId: req.apiAuth.merchant.userId,
      revokedByRole: "merchant",
    });
    return result;
  }
}
 */

// src/modules/api-access/presentation/api-credentials.controller.ts
import { Body, Controller, Delete, HttpCode, Param, Post, UseGuards } from '@nestjs/common'

import { ApiKeyGuard } from '@infra/guards/api-key.guard'
import { CurrentApiAuth } from '@infra/auth-infra/decorators/current-api-auth.decorator'

import { IssueApiCredentialUseCase } from '../application/use-cases/issue-api-credential.use-case'
import {
  RevokeApiKeyUseCase,
  RevokeActorRole,
} from '../application/use-cases/revoke-api-key.use-case'
import { ApiAuthContext } from '../application/use-cases/authenticate-api-key.use-case'

import { IssueApiCredentialRequestDTO } from '../application/dto/request/issue-api-credential.request.dto'
import { RevokeApiKeyRequestDTO } from '../application/dto/request/revoke-api-key.request.dto'

@Controller('v1/api-credentials')
@UseGuards(ApiKeyGuard)
export class ApiCredentialsController {
  constructor(
    private readonly issueCredential: IssueApiCredentialUseCase,
    private readonly revokeKey: RevokeApiKeyUseCase,
  ) {}

  /**
   * Self-service: el merchant emite una key para su propio ApiClient.
   * El `merchantProfileId` sale de `req.apiAuth`, no del body — el cliente no decide por quién.
   * `rawKey` se devuelve UNA sola vez. El cliente debe guardarlo.
   */
  @Post()
  async issue(@Body() body: IssueApiCredentialRequestDTO, @CurrentApiAuth() auth: ApiAuthContext) {
    const result = await this.issueCredential.execute({
      merchantProfileId: auth.merchant.id,
      environment: body.environment,
      requestedByUserId: auth.merchant.userId,
    })

    return {
      apiCredentialId: result.apiCredentialId,
      rawKey: result.rawKey, // ← se muestra una única vez
      prefix: result.prefix,
      environment: result.environment,
      createdAt: result.createdAt,
    }
  }

  @Delete(':id')
  @HttpCode(200)
  async revoke(
    @Param('id') credentialId: string,
    @Body() body: RevokeApiKeyRequestDTO,
    @CurrentApiAuth() auth: ApiAuthContext,
  ) {
    return this.revokeKey.execute({
      credentialId,
      reason: body.reason,
      revokedByUserId: auth.merchant.userId,
      revokedByRole: RevokeActorRole.MERCHANT,
    })
  }
}
