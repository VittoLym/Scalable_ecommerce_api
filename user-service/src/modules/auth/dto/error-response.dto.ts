export class ErrorResponseDto {
  success: boolean;
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path?: string;
  method?: string;
  details?: any; // Para errores de validación u otros detalles

  constructor(partial: Partial<ErrorResponseDto>) {
    Object.assign(this, partial);
    this.success = false;
    this.timestamp = new Date().toISOString();
  }
}
