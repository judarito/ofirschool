import type { ApiResponse } from '@ofir/shared'

export const ok = <T>(message: string, data: T, meta?: Record<string, unknown>): ApiResponse<T> => ({
  success: true,
  message,
  data,
  meta,
})

export const created = <T>(message: string, data: T): ApiResponse<T> => ({
  success: true,
  message,
  data,
})
