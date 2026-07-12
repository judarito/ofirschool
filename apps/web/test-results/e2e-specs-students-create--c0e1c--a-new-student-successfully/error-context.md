# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/specs/students-create.spec.ts >> Students - Create student >> should create a new student successfully
- Location: e2e/specs/students-create.spec.ts:12:3

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for navigation to "http://localhost:5173/" until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - generic [ref=e7]: OF
      - generic [ref=e8]:
        - strong [ref=e9]: OfirSchool
        - text: SaaS escolar multi-tenant
    - generic [ref=e10]:
      - generic [ref=e11]: Administración escolar
      - heading "Un solo panel para admisiones, matrículas y operación académica." [level=1] [ref=e12]
      - paragraph [ref=e13]: Gestiona procesos públicos de inscripción, seguimiento interno y matrícula anual sin salir del mismo flujo.
    - generic [ref=e14]:
      - article [ref=e15]:
        - generic [ref=e16]: AD
        - generic [ref=e17]:
          - strong [ref=e18]: Admisiones
          - paragraph [ref=e19]: Publica formularios por año lectivo y convierte solicitudes a matrícula.
      - article [ref=e20]:
        - generic [ref=e21]: AC
        - generic [ref=e22]:
          - strong [ref=e23]: Académico
          - paragraph [ref=e24]: Grados, cursos, periodos y seguimiento anual desde la misma base de datos.
      - article [ref=e25]:
        - generic [ref=e26]: FI
        - generic [ref=e27]:
          - strong [ref=e28]: Financiero
          - paragraph [ref=e29]: La matrícula se vuelve el origen para cartera, pagos y reportes posteriores.
  - generic [ref=e30]:
    - generic [ref=e31]:
      - generic [ref=e32]:
        - text: Acceso seguro
        - heading "Ingreso al panel" [level=2] [ref=e33]
        - paragraph [ref=e34]: Usa el tenant demo para probar el flujo completo del sistema.
      - generic [ref=e35]: Tenant demo
    - generic [ref=e36]:
      - strong [ref=e37]: Cuentas de prueba
      - generic [ref=e38]:
        - generic [ref=e39]: Correo
        - code [ref=e40]: admin@demo.ofirschool.com
      - generic [ref=e41]:
        - generic [ref=e42]: Contraseña
        - code [ref=e43]: ChangeMe123*
    - generic [ref=e44]:
      - generic [ref=e45]: Correo
      - textbox "Correo" [ref=e46]: admin@demo.ofirschool.com
    - generic [ref=e47]:
      - generic [ref=e48]: Contraseña
      - textbox "Contraseña" [ref=e49]: ChangeMe123*
    - paragraph [ref=e50]: Failed to fetch
    - button "Ingresar al panel" [ref=e51] [cursor=pointer]
    - generic [ref=e52]:
      - generic [ref=e53]: Cloudflare Workers
      - generic [ref=e54]: Neon PostgreSQL
      - generic [ref=e55]: Vue 3 + Hono
```

# Test source

```ts
  1  | import type { Page, Locator } from '@playwright/test'
  2  | import { url } from '../helpers'
  3  | 
  4  | export class LoginPage {
  5  |   readonly page: Page
  6  |   readonly emailInput: Locator
  7  |   readonly passwordInput: Locator
  8  |   readonly submitButton: Locator
  9  | 
  10 |   constructor(page: Page) {
  11 |     this.page = page
  12 |     this.emailInput = page.locator('input[type="email"]')
  13 |     this.passwordInput = page.locator('input[type="password"]')
  14 |     this.submitButton = page.locator('button[type="submit"]')
  15 |   }
  16 | 
  17 |   async goto() {
  18 |     await this.page.goto(url('/login'))
  19 |   }
  20 | 
  21 |   async fillEmail(email: string) {
  22 |     await this.emailInput.fill(email)
  23 |   }
  24 | 
  25 |   async fillPassword(password: string) {
  26 |     await this.passwordInput.fill(password)
  27 |   }
  28 | 
  29 |   async clickSubmit() {
  30 |     await this.submitButton.click()
  31 |   }
  32 | 
  33 |   async login(email: string, password: string) {
  34 |     await this.goto()
  35 |     await this.fillEmail(email)
  36 |     await this.fillPassword(password)
  37 |     await this.clickSubmit()
> 38 |     await this.page.waitForURL(url('/'))
     |                     ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  39 |   }
  40 | }
  41 | 
```