import { UserProfile } from '../user-profile.entity'

export interface IUserProfileRepository {
  findById(id: string): Promise<UserProfile | null>
  findByUserId(userId: string): Promise<UserProfile | null>
  save(UserProfile: UserProfile): Promise<void>
}
