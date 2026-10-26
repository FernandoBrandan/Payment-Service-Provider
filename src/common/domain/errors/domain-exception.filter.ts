// src/common/domain/errors/domain-exception.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common'
import { Request, Response } from 'express'

import {
  DomainAuthError,
  DomainConflictError,
  DomainError,
  DomainForbiddenError,
  DomainNotFoundError,
  DomainRuleError,
  DomainValidationError,
} from './domain.error'

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name)

  catch(exception: DomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const req = ctx.getRequest<Request & { correlationId?: string }>()
    const res = ctx.getResponse<Response>()
    const status = this.statusFor(exception)

    const meta = {
      code: exception.code,
      message: exception.message,
      path: req.url,
      correlationId: req.correlationId,
    }

    if (status >= 500) this.logger.error(meta, exception.stack)
    else this.logger.warn(meta)

    // Auth: el cliente SOLO ve 401 genérico. El `code` queda en logs.
    if (exception instanceof DomainAuthError) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Unauthorized',
        timestamp: new Date().toISOString(),
        path: req.url,
        correlationId: req.correlationId,
      })
      return
    }

    res.status(status).json({
      statusCode: status,
      code: exception.code,
      message: exception.message,
      timestamp: new Date().toISOString(),
      path: req.url,
      correlationId: req.correlationId,
    })
  }

  private statusFor(error: DomainError): number {
    if (error instanceof DomainValidationError) return HttpStatus.BAD_REQUEST
    if (error instanceof DomainAuthError) return HttpStatus.UNAUTHORIZED
    if (error instanceof DomainForbiddenError) return HttpStatus.FORBIDDEN
    if (error instanceof DomainNotFoundError) return HttpStatus.NOT_FOUND
    if (error instanceof DomainConflictError) return HttpStatus.CONFLICT
    if (error instanceof DomainRuleError) return HttpStatus.UNPROCESSABLE_ENTITY
    // Defensivo: alguien extendió DomainError sin categoría.
    return HttpStatus.INTERNAL_SERVER_ERROR
  }
}
