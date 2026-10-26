import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import { ApiClientStatus } from '../../domain/api-client.entity'

@Entity({ name: 'api_clients' })
export class ApiClientOrmEntity {
  @PrimaryColumn('uuid')
  id!: string

  // 1 ApiClient por merchant (ver comentario en IApiClientRepository).
  // El índice único es la garantía real ante carreras concurrentes.
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  merchantProfileId!: string

  @Column({ type: 'varchar', length: 100 })
  name!: string

  @Column({ type: 'varchar', length: 320 })
  email!: string

  @Index()
  @Column({
    type: 'enum',
    enum: ApiClientStatus,
    enumName: 'api_client_status',
    default: ApiClientStatus.ACTIVE,
  })
  status!: ApiClientStatus

  @Column({ type: 'varchar', length: 500, nullable: true })
  suspendedReason!: string | null

  @Column({ type: 'timestamptz', nullable: true })
  suspendedAt!: Date | null

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date
}
