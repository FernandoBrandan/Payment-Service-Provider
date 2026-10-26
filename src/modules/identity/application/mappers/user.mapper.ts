// application/mappers/user.mapper.ts
import { AuthUser } from '../../domain/auth-user.entity'
import { KycStatus, MerchantApplicationStatus } from '../../domain/enums'
import { UserProfile } from '../../domain/user-profile.entity'
import { UserResponseDTO } from '../dto/response/user.response.dto'

export class UserMapper {
  static toResponse(authUser: AuthUser, profile: UserProfile | null): UserResponseDTO {
    return {
      id: authUser.id,
      email: authUser.email,
      roles: authUser.roles,
      status: authUser.status,
      profileId: profile?.id ?? '',
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      kycStatus: profile?.kycStatus as KycStatus,
      merchantApplicationStatus: profile?.merchantApplicationStatus as MerchantApplicationStatus,
      merchantProfileId: profile?.merchantProfileId,
    }
  }
}
