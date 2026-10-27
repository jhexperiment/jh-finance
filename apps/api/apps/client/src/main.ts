import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ENV, Env, setupSwagger } from '@libs/config';
import { ClientModule } from './client.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    ClientModule,
    new FastifyAdapter({ logger: false }),
  );
  const env = app.get<Env>(ENV);
  // Nested Fastify types from @fastify/multipart disagree with Nest's Fastify copy.
  await app.register(require('@fastify/multipart') as never, { limits: { fileSize: 20 * 1024 * 1024 } });
  app.setGlobalPrefix(env.API_PREFIX, { exclude: ['health'] });
  app.enableCors({ origin: env.WEB_ORIGIN });
  setupSwagger(app, 'JH Finance API');
  await app.listen(env.PORT, '0.0.0.0');
  new Logger('client').log(`Listening on ${env.PORT}`);
}

bootstrap();
