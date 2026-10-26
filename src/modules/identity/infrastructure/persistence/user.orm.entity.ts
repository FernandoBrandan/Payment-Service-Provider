import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import {
  DocumentType,
  IAddress,
  IUserPreferences,
  KycStatus,
  MerchantApplicationStatus,
} from '../../domain/enums'

@Entity({ name: 'users' })
export class UserOrmEntity {
  @PrimaryColumn('uuid') id!: string

  @Index() @Column({ type: 'uuid' }) userId!: string

  @Column({ type: 'varchar', length: 100, default: '' }) firstName!: string
  @Column({ type: 'varchar', length: 100, default: '' }) lastName!: string
  @Column({ type: 'jsonb' }) preferences!: IUserPreferences

  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING })
  kycStatus!: KycStatus

  @Column({
    type: 'enum',
    enum: MerchantApplicationStatus,
    default: MerchantApplicationStatus.NONE,
  })
  merchantApplicationStatus!: MerchantApplicationStatus

  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date

  @Column({ type: 'varchar', length: 30, nullable: true }) phone!: string | null
  @Column({ type: 'date', nullable: true }) dateOfBirth!: Date | null
  @Column({ type: 'enum', enum: DocumentType, nullable: true }) documentType!: DocumentType | null
  @Column({ type: 'varchar', length: 50, nullable: true }) documentId!: string | null
  @Column({ type: 'jsonb', nullable: true }) address!: IAddress | null
  @Column({ type: 'varchar', length: 500, nullable: true }) avatarUrl!: string | null
  @Column({ type: 'timestamptz', nullable: true }) kycReviewedAt!: Date | null
  @Column({ type: 'uuid', nullable: true }) kycReviewedByAdminId!: string | null
  @Column({ type: 'uuid', nullable: true }) ledgerAccountId!: string | null
  @Column({ type: 'uuid', nullable: true }) merchantProfileId!: string | null
  @Column({ type: 'uuid', nullable: true }) merchantRequestId!: string | null
  @Column({ type: 'timestamptz', nullable: true }) deletedAt!: Date | null
}
