/* // modules/api-access/infrastructure/guards/api-key.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthenticateApiKeyUseCase } from '../../application/authenticate-api-key.use-case'
import { ApiAuthenticationError } from '../../domain/errors/api-access.errors'

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly authenticate: AuthenticateApiKeyUseCase) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest()
    const rawApiKey = this.extractBearer(req.headers['authorization'])

    try {
      const auth = await this.authenticate.execute({ rawApiKey })
      req.apiAuth = auth // { credential, apiClient, merchant }
      return true
    } catch (err) {
      if (err instanceof ApiAuthenticationError) {
        // El cliente SOLO ve 401 genérico. El `code` queda en logs.
        throw new UnauthorizedException()
      }
      throw err
    }
  }

  private extractBearer(header: string | undefined): string | null {
    if (!header) return null
    const [scheme, token] = header.split(' ')
    if (scheme?.toLowerCase() !== 'bearer' || !token) return null
    return token.trim()
  }
}
 */

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Request } from 'express'

import {
  ApiAuthContext,
  AuthenticateApiKeyUseCase,
} from '../../modules/api-access/application/use-cases/authenticate-api-key.use-case'

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly authenticate: AuthenticateApiKeyUseCase) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>()
    const rawApiKey = this.extractBearer(req.headers['authorization'])
    const auth: ApiAuthContext = await this.authenticate.execute({ rawApiKey })
    req.apiAuth = auth
    return true
  }

  private extractBearer(header: string | undefined): string | null {
    if (!header) return null
    const [scheme, token] = header.split(' ')
    if (scheme?.toLowerCase() !== 'bearer' || !token) return null
    return token.trim()
  }
}
