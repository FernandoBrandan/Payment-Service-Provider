// src/common/types/express.d.ts
import type { AccessTokenPayload } from '@infra/auth-infra/ports/token.service'
import type { ApiAuthContext } from '@modules/api-access/application/authenticate-api-key.use-case'

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload
      apiAuth?: ApiAuthContext
      correlationId?: string
    }
  }
}

export {}
