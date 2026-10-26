import { Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { envSchema } from './env.validation'

const env = process.env.NODE_ENV || 'dev'
const envFile = env === 'dev' ? '.env.dev' : '.env'

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFile,
      validationSchema: envSchema,
      // validationOptions: { abortEarly: false },
    }),
  ],
})
export class ConfigModule {}

// validationOptions: { abortEarly: false },
// El literal de objeto solo puede especificar propiedades conocidas y 'abortEarly' no existe en el tipo 'Options'.
