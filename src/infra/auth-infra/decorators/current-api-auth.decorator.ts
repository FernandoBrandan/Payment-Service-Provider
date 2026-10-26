// src/infra/auth-infra/decorators/current-api-auth.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { ApiAuthContext } from '../../../modules/api-access/application/use-cases/authenticate-api-key.use-case'

export const CurrentApiAuth = createParamDecorator(
  (data: keyof ApiAuthContext | undefined, ctx: ExecutionContext): unknown => {
    const req = ctx.switchToHttp().getRequest<{ apiAuth?: ApiAuthContext }>()
    return data ? req.apiAuth?.[data] : req.apiAuth
  },
)
