// src/modules/api-access/presentation/dto/request/revoke-api-key.request.dto.ts
import { IsString, MinLength } from 'class-validator'

export class RevokeApiKeyRequestDTO {
  @IsString()
  @MinLength(1)
  reason!: string
}
