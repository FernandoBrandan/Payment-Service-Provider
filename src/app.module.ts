import { Module } from '@nestjs/common'
import { createObserveModule } from '@nestjs/observe'

import { ConfigModule } from '@infra/config/config.module'
import { DatabaseModule } from '@infra/database/database.module'
import { IdentityModule } from './modules/identity/identity.module'
import { ApiAccessModule } from './modules/api-access/api-access.module'

export const { ObserveModule, ObserveInstrument } = createObserveModule()

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'pr_pasarela_de_pago',
    }),
    ConfigModule,
    DatabaseModule,
    IdentityModule,
    ApiAccessModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
