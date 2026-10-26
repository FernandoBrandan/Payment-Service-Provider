import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'

import { HASH_SERVICE, TOKEN_SERVICE } from '@infra/tokens'
import { PasswordHasher } from './services/password-hasher.service'
import { JwtTokenService } from './services/jwt-token.service'
import { AuthGuard } from './guards/jwt-auth.guard'
import { RolesGuard } from './guards/roles.guard'

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '15m') },
      }),
    }),
  ],
  providers: [
    { provide: HASH_SERVICE, useClass: PasswordHasher },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    AuthGuard,
    RolesGuard,
  ],
  exports: [HASH_SERVICE, TOKEN_SERVICE, AuthGuard, RolesGuard, JwtModule],
})
export class AuthInfraModule {}
