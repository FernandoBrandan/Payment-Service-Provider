// merchant-profile.orm.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import { MerchantProfileStatus } from '../../domain/enums'

@Entity({ name: 'merchant_profiles' })
export class MerchantProfileOrmEntity {
  @PrimaryColumn('uuid')
  id!: string

  @Index()
  @Column({ type: 'uuid' })
  userId!: string

  @Index()
  @Column({ type: 'uuid' })
  ownerId!: string

  @Column({ type: 'uuid', nullable: true })
  ledgerAccountId!: string | null

  @Column({ type: 'int', default: 0 })
  activeApiKeyCount!: number

  @Column({ type: 'varchar', length: 200 })
  businessName!: string

  @Column({ type: 'varchar', length: 50 })
  taxId!: string

  @Column({ type: 'varchar', length: 100 })
  category!: string

  @Column({ type: 'int', default: 250 })
  feeBasisPoints!: number

  @Index()
  @Column({
    type: 'enum',
    enum: MerchantProfileStatus,
    enumName: 'merchant_profile_status',
    default: MerchantProfileStatus.ACTIVE,
  })
  status!: MerchantProfileStatus

  @Column({ type: 'varchar', length: 500, nullable: true })
  statusReason!: string | null

  @Column({ type: 'timestamptz', nullable: true })
  statusChangedAt!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt!: Date | null

  @Column({ type: 'uuid', nullable: true })
  approvedByAdminId!: string | null

  @Column({ type: 'timestamptz', nullable: true })
  deactivatedAt!: Date | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  deactivatedReason!: string | null

  @Column({ type: 'uuid', nullable: true })
  deactivatedByAdminId!: string | null

  @Column({ type: 'uuid', nullable: true })
  updatedByAdminId!: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date
}
