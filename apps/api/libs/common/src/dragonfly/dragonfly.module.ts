import { Global, Inject, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ENV, Env } from '@libs/config';

export const DRAGONFLY = 'DRAGONFLY';

class DragonflyHost implements OnModuleDestroy {
  constructor(private readonly client: Redis) {}

  async onModuleDestroy() {
    this.client.disconnect();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DRAGONFLY,
      inject: [ENV],
      useFactory: (env: Env) => {
        const logger = new Logger('DragonflyModule');
        const client = new Redis(env.DRAGONFLY_URL, {
          maxRetriesPerRequest: null,
          lazyConnect: true,
        });
        client.on('error', (error) => {
          logger.warn(`Dragonfly error: ${error.message}`);
        });
        return client;
      },
    },
    {
      provide: DragonflyHost,
      inject: [DRAGONFLY],
      useFactory: (client: Redis) => new DragonflyHost(client),
    },
  ],
  exports: [DRAGONFLY],
})
export class DragonflyModule {}

export { Inject };
