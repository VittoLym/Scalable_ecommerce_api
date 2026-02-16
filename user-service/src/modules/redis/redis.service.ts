import Redis from 'ioredis';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RedisService {
  private redis = new Redis({
    host: 'localhost',
    port: 6379,
  });

  async blacklistToken(jti: string, expiresIn: number) {
    await this.redis.set(`bl:${jti}`, 'true', 'EX', expiresIn);
  }

  async isBlacklisted(jti: string) {
    return (await this.redis.get(`bl:${jti}`)) !== null;
  }
}
