import { Column, Entity, Index, PrimaryColumn } from 'typeorm'
import { ApiCredentialStatus, ApiEnvironment } from '../../domain/api-credential.entity'

@Entity({ name: 'api_credentials' })
export class ApiCredentialOrmEntity {
  @PrimaryColumn('uuid')
  id!: string

  @Index()
  @Column({ type: 'uuid' })
  apiClientId!: string

  @Column({
    type: 'enum',
    enum: ApiEnvironment,
    enumName: 'api_environment',
  })
  environment!: ApiEnvironment

  // Prefijo público para lookup (sk_live_/sk_test_ + 4 chars del random).
  // No UNIQUE: colisiones astronómicamente improbables pero posibles;
  // `findByPrefix` devuelve la primera, y `verify()` (timingSafeEqual)
  // descarta el mismatch. Índice normal para que el lookup no haga full scan.
  @Index()
  @Column({ type: 'varchar', length: 12 })
  prefix!: string

  // SHA-256 hex del rawKey completo. NUNCA se persiste el rawKey.
  @Column({ type: 'varchar', length: 64 })
  keyHash!: string

  @Index()
  @Column({
    type: 'enum',
    enum: ApiCredentialStatus,
    enumName: 'api_credential_status',
    default: ApiCredentialStatus.ACTIVE,
  })
  status!: ApiCredentialStatus

  @Column({ type: 'timestamptz' })
  createdAt!: Date

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  revokedReason!: string | null
}

// Nota: no agrego @UpdateDateColumn porque IApiCredential no expone updatedAt en el dominio.
// Si después querés auditarlo, lo agregás al entity + mapper.
