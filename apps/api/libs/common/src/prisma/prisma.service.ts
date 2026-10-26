import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ENV, Env } from '@libs/config';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private pool?: Pool;
  private client?: { $connect: () => Promise<void>; $disconnect: () => Promise<void> };
  private ready = false;

  constructor(@Inject(ENV) private readonly env: Env) {}

  isReady() {
    return this.ready;
  }

  async onModuleInit() {
    if (!this.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL missing; domain services will use fixtures');
      return;
    }

    try {
      const { PrismaClient } = await import('../../../../generated/prisma/client');
      this.pool = new Pool({ connectionString: this.env.DATABASE_URL });
      this.client = new PrismaClient({ adapter: new PrismaPg(this.pool) });
      await this.client?.$connect();
      this.ready = true;
    } catch (error) {
      this.logger.warn(
        `Prisma is not connected (${error instanceof Error ? error.message : 'unknown'}); serving fixture data`,
      );
    }
  }

  async onModuleDestroy() {
    await this.client?.$disconnect();
    await this.pool?.end();
  }
}
