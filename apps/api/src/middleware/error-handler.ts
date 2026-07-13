import type { Context } from 'hono'
import { ZodError } from 'zod'
import { AppError } from '../lib/errors'

export const errorHandler = (error: Error, c: Context) => {
  const requestId = c.get('requestId' as never) as string | undefined

  if (error instanceof AppError) {
    return c.json(
      {
        success: false,
        message: error.message,
        errorCode: error.code,
        requestId: requestId ?? null,
        details: error.details ?? null,
      },
      error.status as 400,
    )
  }

  if (error instanceof ZodError) {
    return c.json(
      {
        success: false,
        message: 'Error de validacion',
        errorCode: 'VALIDATION_ERROR',
        requestId: requestId ?? null,
        details: error.flatten(),
      },
      422,
    )
  }

  console.error('Unhandled API error', {
    requestId: requestId ?? null,
    name: error.name,
    message: error.message,
    stack: error.stack,
  })

  return c.json(
    {
      success: false,
      message: 'Error interno del servidor',
      errorCode: 'INTERNAL_SERVER_ERROR',
      requestId: requestId ?? null,
    },
    500,
  )
}
