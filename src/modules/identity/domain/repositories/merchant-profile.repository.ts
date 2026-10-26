import { MerchantProfile } from '../merchant-profile.entity'

export interface IMerchantProfileRepository {
  findById(id: string): Promise<MerchantProfile | null>
  save(profile: MerchantProfile): Promise<void>
}
