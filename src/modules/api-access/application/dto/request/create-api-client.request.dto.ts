// src/modules/api-access/presentation/dto/request/create-api-client.request.dto.ts
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

export class CreateApiClientRequestDTO {
  @IsUUID()
  merchantProfileId!: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @IsEmail()
  technicalEmail!: string
}
