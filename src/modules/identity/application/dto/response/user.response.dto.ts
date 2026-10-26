// application/dto/response/user.response.dto.ts
import {
  AccountStatus,
  KycStatus,
  MerchantApplicationStatus,
  UserRole,
} from '../../../../../modules/identity/domain/enums'

export class UserResponseDTO {
  id: string
  email: string
  roles: UserRole[]
  status: AccountStatus

  profileId: string
  firstName: string
  lastName: string
  kycStatus: KycStatus
  merchantApplicationStatus: MerchantApplicationStatus
  merchantProfileId?: string
}
