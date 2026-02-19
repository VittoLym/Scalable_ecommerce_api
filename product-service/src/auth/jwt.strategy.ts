import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private redisService: RedisService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: any) {
    const isBlacklisted = await this.redisService.isBlacklisted(payload.jti);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token blacklisted');
    }
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
