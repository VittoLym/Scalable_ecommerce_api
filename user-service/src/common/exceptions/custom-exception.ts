import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: any,
  ) {
    super(
      {
        message,
        statusCode,
        error: 'BusinessException',
        details,
      },
      statusCode,
    );
  }
}

export class UserNotFoundException extends BusinessException {
  constructor(details?: any) {
    super('Usuario no encontrado', HttpStatus.NOT_FOUND, details);
  }
}

export class InvalidCredentialsException extends BusinessException {
  constructor(details?: any) {
    super('Credenciales inválidas', HttpStatus.UNAUTHORIZED, details);
  }
}

export class EmailNotVerifiedException extends BusinessException {
  constructor(details?: any) {
    super('Email no verificado', HttpStatus.FORBIDDEN, details);
  }
}

export class TokenBlacklistedException extends BusinessException {
  constructor(details?: any) {
    super('Token ha sido revocado', HttpStatus.UNAUTHORIZED, details);
  }
}

export class UserAlreadyExistsException extends BusinessException {
  constructor(details?: any) {
    super('El usuario ya existe', HttpStatus.CONFLICT, details);
  }
}

export class TokenExpiredException extends BusinessException {
  constructor(details?: any) {
    super('Token expirado', HttpStatus.UNAUTHORIZED, details);
  }
}

export class InvalidTokenException extends BusinessException {
  constructor(details?: any) {
    super('Token inválido', HttpStatus.UNAUTHORIZED, details);
  }
}

export class DatabaseException extends BusinessException {
  constructor(message: string = 'Error en la base de datos', details?: any) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, details);
  }
}
