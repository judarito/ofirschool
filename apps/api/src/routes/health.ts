import { Hono } from 'hono'

export const healthRoutes = new Hono()

healthRoutes.get('/', (c) =>
  c.json({
    success: true,
    message: 'API operativa',
    data: {
      service: 'ofir-school-api',
      now: new Date().toISOString(),
    },
  }),
)
