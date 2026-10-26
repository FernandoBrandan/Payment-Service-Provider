// auth-user.orm.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import { AccountStatus, UserRole } from '../../domain/enums'

@Entity({ name: 'auth_users' })
export class AuthUserOrmEntity {
  @PrimaryColumn('uuid')
  id!: string

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 320 })
  email!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordHash!: string | null

  @Column({ type: 'boolean', default: false })
  emailVerified!: boolean

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null

  @Column({ type: 'enum', enum: UserRole, array: true, default: () => `'{${UserRole.CLIENT}}'` })
  roles!: UserRole[]

  @Index()
  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.ACTIVE })
  status!: AccountStatus

  @Column({ type: 'varchar', length: 500, nullable: true })
  statusReason!: string | null

  @Column({ type: 'timestamptz', nullable: true })
  statusChangedAt!: Date | null

  // --- Ban ---
  @Column({ type: 'timestamptz', nullable: true })
  bannedAt!: Date | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  banReason!: string | null

  @Column({ type: 'uuid', nullable: true })
  bannedByAdminId!: string | null

  // --- Sesión / seguridad ---
  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  passwordChangedAt!: Date | null

  @Column({ type: 'boolean', default: false })
  twoFactorEnabled!: boolean

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  twoFactorSecret!: string | null

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts!: number

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil!: Date | null

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date
}
