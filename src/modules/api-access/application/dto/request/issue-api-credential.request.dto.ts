// src/modules/api-access/presentation/dto/request/issue-api-credential.request.dto.ts
import { IsEnum } from 'class-validator'
import { ApiEnvironment } from '../../../domain/api-credential.entity'

export class IssueApiCredentialRequestDTO {
  @IsEnum(ApiEnvironment)
  environment!: ApiEnvironment
}
