import type { Context } from 'hono'
import { ZodError } from 'zod'
import { AppError } from '../lib/errors'

export const errorHandler = (error: Error, c: Context) => {
  if (error instanceof AppError) {
    return c.json(
      {
        success: false,
        message: error.message,
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
        details: error.flatten(),
      },
      422,
    )
  }

  console.error(error)

  return c.json(
    {
      success: false,
      message: 'Error interno del servidor',
    },
    500,
  )
}
