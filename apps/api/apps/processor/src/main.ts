import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ENV, Env } from '@libs/config';
import { ProcessorModule } from './processor.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    ProcessorModule,
    new FastifyAdapter({ logger: false }),
  );
  const env = app.get<Env>(ENV);
  await app.listen(env.PROCESSOR_PORT, '0.0.0.0');
  new Logger('processor').log(`Health on ${env.PROCESSOR_PORT}`);
}

bootstrap();
