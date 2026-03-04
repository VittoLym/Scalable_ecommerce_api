import Redis from 'ioredis';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private isConnected = false;

  constructor() {
    this.connect();
  }
  private connect() {
    const redisHost = process.env.REDIS_HOST || 'redis';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    this.logger.log(`🔌 Conectando a Redis en ${redisHost}:${redisPort}`);

    this.client = new Redis({
      host: redisHost,
      port: redisPort,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.log(`⏳ Reintentando conexión en ${delay}ms (intento ${times})`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true, // ← IMPORTANTE: No conecta automáticamente
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      this.logger.log('✅ Conectado a Redis exitosamente');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      // Solo loguear errores que no sean de reintento
      if (error.message !== 'ECONNREFUSED') {
        this.logger.error('❌ Error de Redis:', error.message);
      }
    });

    this.client.on('close', () => {
      this.isConnected = false;
      this.logger.warn('🔌 Conexión a Redis cerrada');
    });

    // Intentar conexión inicial
    this.client.connect().catch(() => {
      // Ignorar error inicial, el retryStrategy se encargará
    });
  }
  async onModuleInit() {
    // Esperar a que Redis esté listo antes de que la app arranque
    let attempts = 0;
    while (!this.isConnected && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    if (this.isConnected) {
      this.logger.log('🚀 Redis listo para usar');
    } else {
      this.logger.warn('⚠️ Redis no disponible, continuando sin caché');
    }
  }
  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('👋 Conexión a Redis cerrada');
  }
  async blacklistToken(jti: string, expiresIn: number) {
    if (!this.isConnected) {
      this.logger.warn('Redis no disponible, saltando blacklist');
      return;
    }
    try {
      await this.client.set(`bl:${jti}`, 'true', 'EX', expiresIn);
    } catch (error) {
      this.logger.error('Error en blacklistToken:', error);
    }
  }
  async isBlacklisted(jti: string) {
    if (!this.isConnected) {
      return false;
    }
    try {
      const result = await this.client.get(`bl:${jti}`);
      return result !== null;
    } catch (error) {
      this.logger.error('Error en isBlacklisted:', error);
      return false;
    }
  }
  async ping(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Error en ping:', error);
      return false;
    }
  }
  async get(key: string): Promise<any> {
    const value = await this.client.get(key);
    if (value) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return null;
  }
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, stringValue);
    } else {
      await this.client.set(key, stringValue);
    }
  }
  async del(key: string | string[]): Promise<void> {
    if (Array.isArray(key)) {
      await this.client.del(...key);
    } else {
      await this.client.del(key);
    }
  }
  async delByPattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }
  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }
  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }
  async flushAll(): Promise<void> {
    await this.client.flushall();
  }
  async mget(keys: string[]): Promise<any[]> {
    const values = await this.client.mget(keys);
    return values.map(value => {
      if (value) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return null;
    });
  }
  async mset(obj: Record<string, any>): Promise<void> {
    const entries = Object.entries(obj).flatMap(([key, value]) => [
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
    ]);
    await this.client.mset(...entries);
  }
}
