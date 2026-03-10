import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const User = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Si no hay usuario, retorna undefined (los guards ya lanzaron excepción)
    if (!user) {
      return undefined;
    }

    // Si se solicita un campo específico, retorna solo ese campo
    if (data) {
      return user[data];
    }

    // Retorna el usuario completo
    return user;
  },
);
