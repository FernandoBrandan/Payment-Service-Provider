import { AuthUser } from '../auth-user.entity'

export interface IAuthUserRepository {
  findById(id: string): Promise<AuthUser | null>
  findByEmail(email: string): Promise<AuthUser | null>
  save(AuthUser: AuthUser): Promise<void>
}
