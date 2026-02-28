// user-service/src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponseDto } from '../../modules/auth/dto/error-response.dto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = 'Error interno del servidor';
    let error: string = 'UnknownError';
    let details: any;
    this.logger.error(
      `Error en ${request.method} ${request.url}:`,
      exception instanceof Error ? exception.stack : exception,
    );
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
        error = (exceptionResponse as any).error || exception.name;
        details = (exceptionResponse as any).details;
      }
    } else if (exception instanceof Error) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message || 'Error interno del servidor';
      error = exception.name;
      if (process.env.NODE_ENV === 'development') {
        details = {
          stack: exception.stack,
        };
      }
    } else {
      // Errores desconocidos
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Error interno del servidor';
      error = 'UnknownError';
    }
    const errorResponse = new ErrorResponseDto({
      statusCode,
      message,
      error,
      details,
      path: request.url,
      method: request.method,
    });

    response.status(statusCode).json(errorResponse);
  }
}
