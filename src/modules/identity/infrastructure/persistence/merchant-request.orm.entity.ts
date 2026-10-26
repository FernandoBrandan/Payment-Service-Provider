// merchant-request.orm.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import { MerchantRequestStatus } from '../../domain/enums'

@Entity({ name: 'merchant_requests' })
export class MerchantRequestOrmEntity {
  @PrimaryColumn('uuid')
  id!: string

  @Index()
  @Column({ type: 'uuid' })
  userId!: string

  @Index()
  @Column({ type: 'uuid' })
  ownerId!: string

  @Column({ type: 'varchar', length: 200 })
  businessName!: string

  @Column({ type: 'varchar', length: 50 })
  taxId!: string

  @Column({ type: 'varchar', length: 100 })
  category!: string

  @Column({ type: 'uuid', nullable: true })
  provisionedLedgerAccountId!: string | null

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  expectedMonthlyVolume!: string | null

  @Column({ type: 'varchar', length: 3 })
  businessCurrency!: string

  @Column({ type: 'text', nullable: true })
  additionalNotes!: string | null

  @Column({ type: 'int', default: 250 })
  requestedFeeBasisPoints!: number

  @Index()
  @Column({
    type: 'enum',
    enum: MerchantRequestStatus,
    enumName: 'merchant_request_status',
    default: MerchantRequestStatus.PENDING,
  })
  status!: MerchantRequestStatus

  @Column({ type: 'timestamptz' })
  requestedAt!: Date

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null

  @Column({ type: 'uuid', nullable: true })
  reviewedByAdminId!: string | null

  @Column({ type: 'text', nullable: true })
  reviewNotes!: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date
}
