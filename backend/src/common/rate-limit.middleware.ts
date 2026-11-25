import { Injectable, NestMiddleware, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';

type Bucket = { count: number; resetAt: number };

/** Per-process, per-IP fixed windows. Forwarded headers are not trusted. */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware, OnModuleDestroy {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs: number;
  private readonly limit: number;
  private readonly authLimit: number;
  private readonly cleanup: ReturnType<typeof setInterval>;

  constructor(config: ConfigService) {
    this.windowMs = this.positiveInteger(config, 'RATE_LIMIT_WINDOW_MS', 60000);
    this.limit = this.positiveInteger(config, 'RATE_LIMIT_MAX', 120);
    this.authLimit = this.positiveInteger(config, 'RATE_LIMIT_AUTH_MAX', 10);
    this.cleanup = setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of this.buckets) {
        if (bucket.resetAt <= now) this.buckets.delete(key);
      }
    }, this.windowMs);
    this.cleanup.unref();
  }

  private positiveInteger(
    config: ConfigService,
    key: string,
    fallback: number,
  ) {
    const value = Number(config.get(key) ?? fallback);
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`${key} must be a positive safe integer`);
    }
    return value;
  }

  use(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'OPTIONS') return next();
    const now = Date.now();
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    // Nest mounts middleware on a wildcard; req.path can be relative to it.
    const pathname = req.originalUrl.split('?')[0];
    const isAuth = /^\/auth\/(login|register)\/?$/i.test(pathname);
    const scopes: Array<[string, number]> = [[`api:${ip}`, this.limit]];
    if (isAuth) scopes.push([`auth:${ip}`, this.authLimit]);

    for (const [key, max] of scopes) {
      let bucket = this.buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + this.windowMs };
        this.buckets.set(key, bucket);
      }
      bucket.count++;
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - bucket.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));
      if (bucket.count > max) {
        res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
        return res.status(429).json({
          statusCode: 429,
          message: 'Too many requests',
          error: 'Too Many Requests',
        });
      }
    }
    next();
  }

  onModuleDestroy() {
    clearInterval(this.cleanup);
  }
}
