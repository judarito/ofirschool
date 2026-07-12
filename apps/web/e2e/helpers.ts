export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'

export const url = (path: string) => `${BASE_URL}${path}`
