export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public details?: unknown,
    public code = 'APP_ERROR',
  ) {
    super(message)
  }
}
