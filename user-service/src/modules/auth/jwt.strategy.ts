import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private redisService: RedisService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: any) {
    console.log('JWT validate ejecutándose');
    console.log(payload);
    console.log('🔍 JWT Payload recibido:', payload);
    if (!payload || !payload.jti) {
      console.log('❌ Payload inválido - no tiene jti');
      throw new UnauthorizedException('Token inválido');
    }
    const isBlacklisted = await this.redisService.isBlacklisted(payload.jti);
    console.log('🔍 Token blacklisted?', isBlacklisted); // ← DEBUG
    if (isBlacklisted) {
      console.log('❌ Token en blacklist');
      throw new UnauthorizedException('Token blacklisted');
    }
    console.log('✅ Token válido, usuario:', payload.sub);
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
