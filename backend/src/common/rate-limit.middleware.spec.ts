import {
  Controller,
  Get,
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import type { Request, Response } from 'express';
import { RateLimitMiddleware } from './rate-limit.middleware';

@Controller()
class FixtureController {
  @Get('api/parcels') list() {
    return { ok: true };
  }
  @Post('auth/login') login() {
    return { ok: true };
  }
  @Post('auth/register') register() {
    return { ok: true };
  }
}

@Module({
  controllers: [FixtureController],
  providers: [
    RateLimitMiddleware,
    {
      provide: ConfigService,
      useValue: new ConfigService({
        RATE_LIMIT_WINDOW_MS: 1000,
        RATE_LIMIT_MAX: 3,
        RATE_LIMIT_AUTH_MAX: 1,
      }),
    },
  ],
})
class FixtureModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimitMiddleware).forRoutes('*path');
  }
}

describe('HTTP rate limiting', () => {
  let app: INestApplication;
  let limiter: RateLimitMiddleware;
  let now: jest.SpyInstance;

  beforeEach(async () => {
    now = jest.spyOn(Date, 'now').mockReturnValue(1000000);
    const module = await Test.createTestingModule({
      imports: [FixtureModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    limiter = module.get(RateLimitMiddleware);
  });

  afterEach(async () => {
    limiter.onModuleDestroy();
    now.mockRestore();
    await app.close();
  });

  it('blocks at the boundary across routes and ignores forged forwarded IPs', async () => {
    const http = app.getHttpServer() as Server;
    await request(http).get('/api/parcels').expect(200);
    await request(http).get('/api/parcels').expect(200);
    await request(http).get('/api/parcels').expect(200);
    const blocked = await request(http)
      .get('/api/parcels')
      .set('X-Forwarded-For', '203.0.113.7')
      .expect(429);
    expect(blocked.headers['retry-after']).toBe('1');
    expect(blocked.headers['x-ratelimit-remaining']).toBe('0');
    expect(blocked.body as unknown).toMatchObject({ statusCode: 429 });
    now.mockReturnValue(1001000);
    await request(http).get('/api/parcels').expect(200);
  });

  it('shares the stricter authentication quota across login and register', async () => {
    const http = app.getHttpServer() as Server;
    await request(http).post('/auth/login').expect(201);
    await request(http).post('/auth/register').expect(429);
    await request(http).get('/api/parcels').expect(200);
  });

  it('keeps IP quotas separate and does not charge OPTIONS', () => {
    const next = jest.fn();
    const res = { setHeader: jest.fn() };
    for (let i = 0; i < 4; i++) {
      limiter.use(
        { method: 'OPTIONS' } as Request,
        res as unknown as Response,
        next,
      );
    }
    for (const ip of ['203.0.113.1', '203.0.113.2']) {
      for (let i = 0; i < 3; i++) {
        limiter.use(
          { method: 'GET', originalUrl: '/api/parcels', ip } as Request,
          res as unknown as Response,
          next,
        );
      }
    }
    expect(next).toHaveBeenCalledTimes(10);
  });

  it('rejects unsafe configuration instead of disabling limits', () => {
    expect(
      () =>
        new RateLimitMiddleware(new ConfigService({ RATE_LIMIT_MAX: 'bad' })),
    ).toThrow('RATE_LIMIT_MAX');
  });
});
