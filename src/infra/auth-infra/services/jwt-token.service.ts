import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { AccessTokenPayload, RefreshTokenPayload, TokenService } from '../ports/token.service'

@Injectable()
export class JwtTokenService implements TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccess(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload)
  }

  signRefresh(payload: RefreshTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    })
  }

  async verifyAccess(token: string): Promise<AccessTokenPayload | null> {
    try {
      return await this.jwt.verifyAsync(token)
    } catch {
      return null
    }
  }

  async verifyRefresh(token: string): Promise<RefreshTokenPayload | null> {
    try {
      return await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      })
    } catch {
      return null
    }
  }
}
