import { MerchantRequest } from '../merchant-request.entity'

export interface IMerchantProfileRequestRepository {
  findById(id: string): Promise<MerchantRequest | null>
  save(request: MerchantRequest): Promise<void>
}
