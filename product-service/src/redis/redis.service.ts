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
  private redis: Redis;
  private isConnected = false;

  constructor() {
    this.connect();
  }

  private connect() {
    const redisHost = process.env.REDIS_HOST || 'redis';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    this.logger.log(`🔌 Conectando a Redis en ${redisHost}:${redisPort}`);

    this.redis = new Redis({
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

    this.redis.on('connect', () => {
      this.isConnected = true;
      this.logger.log('✅ Conectado a Redis exitosamente');
    });

    this.redis.on('error', (error) => {
      this.isConnected = false;
      // Solo loguear errores que no sean de reintento
      if (error.message !== 'ECONNREFUSED') {
        this.logger.error('❌ Error de Redis:', error.message);
      }
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      this.logger.warn('🔌 Conexión a Redis cerrada');
    });

    // Intentar conexión inicial
    this.redis.connect().catch(() => {
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
    await this.redis.quit();
    this.logger.log('👋 Conexión a Redis cerrada');
  }

  async blacklistToken(jti: string, expiresIn: number) {
    if (!this.isConnected) {
      this.logger.warn('Redis no disponible, saltando blacklist');
      return;
    }
    try {
      await this.redis.set(`bl:${jti}`, 'true', 'EX', expiresIn);
    } catch (error) {
      this.logger.error('Error en blacklistToken:', error);
    }
  }

  async isBlacklisted(jti: string) {
    if (!this.isConnected) {
      return false;
    }
    try {
      const result = await this.redis.get(`bl:${jti}`);
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
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Error en ping:', error);
      return false;
    }
  }
}
