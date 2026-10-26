import { Global, Module } from '@nestjs/common';
import { envSchema } from './env';

export const ENV = 'ENV';

@Global()
@Module({
  providers: [
    {
      provide: ENV,
      useFactory: () => envSchema.parse(process.env),
    },
  ],
  exports: [ENV],
})
export class ConfigModule {}
