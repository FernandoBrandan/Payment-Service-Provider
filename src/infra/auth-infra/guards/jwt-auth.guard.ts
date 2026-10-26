import {
  CanActivate,
  Inject,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Request } from 'express'
import { TOKEN_SERVICE } from '@infra/tokens'
import { TokenService } from '../ports/token.service'
import { AccountStatus } from '../../../modules/identity/domain/enums'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_SERVICE) private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>()
    const token = this.extractBearer(req.headers.authorization)
    if (!token) throw new UnauthorizedException()

    const payload = await this.tokens.verifyAccess(token)
    if (!payload) throw new UnauthorizedException()
    if (payload.status !== AccountStatus.ACTIVE) throw new UnauthorizedException()

    req.user = payload
    return true
  }

  private extractBearer(header: string | undefined): string | undefined {
    const [scheme, token] = header?.split(' ') ?? []
    return scheme === 'Bearer' ? token : undefined
  }
}
