# Ofir School

Monorepo full-stack para un SaaS multi-tenant de gestion escolar en Colombia.

## Stack

- Frontend: Vue 3 + Vite + TypeScript
- Backend: Hono + TypeScript sobre Cloudflare Workers
- Base de datos: Neon PostgreSQL
- ORM: Drizzle ORM
- Auth: JWT
- Monorepo: `pnpm` workspace

## Estructura

```text
apps/
  web/        # Vue 3 app
  api/        # Hono API para Cloudflare Workers
packages/
  shared/     # Tipos y contratos compartidos
  db/         # Schema, migraciones y seed con Drizzle
  ui/         # Base reutilizable para UI futura
```

## Requisitos

- Node.js 20+
- pnpm 10+

## Variables de entorno

Copiar `.env.example` a `.env` para scripts locales de base de datos.

Para `wrangler dev`, copiar [`apps/api/.dev.vars.example`](/home/juan/Documentos/Dev/Proyectos/OfirSchool/apps/api/.dev.vars.example:1) a `apps/api/.dev.vars`:

```env
DATABASE_URL=postgresql://user:password@host/db?sslmode=require
JWT_SECRET=change-me-super-secret
SUPERADMIN_EMAIL=admin@demo.ofirschool.com
SUPERADMIN_PASSWORD=ChangeMe123*
DEFAULT_TENANT_ID=11111111-1111-1111-1111-111111111111
```

Para frontend:

```env
VITE_API_URL=http://127.0.0.1:8787/api
```

## Adjuntos en R2

Los documentos de inscripción pública ahora se almacenan en Cloudflare R2 usando el binding `ADMISSIONS_BUCKET` definido en [`apps/api/wrangler.toml`](/home/juan/Documentos/Dev/Proyectos/OfirSchool/apps/api/wrangler.toml:1).

Antes de probar adjuntos reales en Cloudflare, crea los buckets:

```bash
cd apps/api
pnpm wrangler r2 bucket create ofirschool-admissions
pnpm wrangler r2 bucket create ofirschool-admissions-preview
```

Luego podrás:

- subir documentos desde el formulario público,
- verlos en el detalle de inscripción del admin,
- descargarlos desde backoffice.

## Instalacion

```bash
corepack enable
corepack prepare pnpm@10.11.0 --activate
pnpm install
```

## Base de datos

Crear migracion inicial ya incluida:

```bash
pnpm db:migrate
pnpm db:seed
```

Cada vez que entren cambios nuevos de esquema, vuelve a correr:

```bash
pnpm db:migrate
```

Esto es obligatorio aunque el frontend compile bien. Si falta una tabla o columna nueva, la UI puede terminar mostrando un `500` genérico desde API.

Ejemplo reciente:

- la pantalla `Materias por grado` depende de la migración `0006_grade_subjects.sql`,
- si esa migración no está aplicada, al guardar una asignación falla el endpoint `/academic/grade-subjects`.

Si prefieres Postgres local:

```bash
docker compose up -d
```

Luego actualiza `DATABASE_URL` a `postgresql://postgres:postgres@localhost:5432/ofirschool`.

## Desarrollo local

En una sola terminal:

```bash
pnpm dev
```

Servicios:

- Web: `http://localhost:5173`
- API: `http://127.0.0.1:8787`

Credenciales seed:

- Email: `admin@demo.ofirschool.com`
- Password: `ChangeMe123*`

## Procesos implementados

### Admision y matricula

- inscripcion publica de estudiantes nuevos,
- formulario dinamico por ano lectivo,
- carga y consulta de documentos en R2,
- bandeja administrativa de inscripciones,
- aprobacion, rechazo y paso a revision con comentarios,
- conversion de inscripcion aprobada a matricula,
- matricula manual de estudiantes antiguos,
- continuidad masiva con validacion de cupos y grupo destino.

### Configuracion academica

- anos lectivos,
- periodos academicos,
- grados,
- cursos,
- catalogo de materias,
- materias por grado,
- plan academico con logros por periodo.

### Operacion academica

- gestion de docentes,
- carga docente por curso y materia,
- directores de grupo y coordinaciones,
- libro de notas por curso, materia y periodo,
- validacion de materias disponibles segun el grado del curso,
- consultas base de estudiantes y matriculas.

## Reglas operativas importantes

- solo puede existir un ano lectivo `activo`,
- el formulario publico de inscripcion debe corresponder al ano lectivo `activo`,
- solo puede quedar publicado un formulario activo por modulo,
- un ano lectivo no puede activarse si sus periodos no suman `100`,
- si un ano lectivo ya tiene operacion, se bloquean cambios estructurales de fechas y ano,
- no se pueden eliminar anos, grados o cursos que ya esten en uso,
- la asignacion base de materias ahora se hace por `grado`, no por `curso`.

## Migraciones clave recientes

- `0005_academic_program.sql`: materias, logros y libro de notas.
- `0006_grade_subjects.sql`: cambio de asignacion de materias de `curso` a `grado`.
- `0012_teacher_responsibilities.sql`: directores de grupo y coordinaciones docentes.

Nota:

- la tabla `course_subjects` puede seguir existiendo en bases viejas por compatibilidad historica,
- la fuente activa del sistema para la malla academica ahora es `grade_subjects`.

## Scripts utiles

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Flujo recomendado cuando cambie el modelo de datos:

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

## Deploy

### Cloudflare Workers

1. Crear proyecto en Cloudflare.
2. Configurar secretos:

```bash
cd apps/api
pnpm wrangler secret put DATABASE_URL
pnpm wrangler secret put JWT_SECRET
pnpm wrangler secret put SUPERADMIN_EMAIL
pnpm wrangler secret put SUPERADMIN_PASSWORD
pnpm wrangler secret put DEFAULT_TENANT_ID
```

3. Crear o verificar los buckets R2 usados por adjuntos:

```bash
pnpm wrangler r2 bucket create ofirschool-admissions
pnpm wrangler r2 bucket create ofirschool-admissions-preview
```

4. Desplegar:

```bash
pnpm --filter @ofir/api deploy
```

### Cloudflare Pages

1. Crear proyecto Pages apuntando a `apps/web`.
2. Configurar `VITE_API_URL` con la URL del Worker.
3. Build command:

```bash
pnpm --filter @ofir/web build
```

4. Output directory:

```text
apps/web/dist
```

## Estado actual

- monorepo full-stack funcional con web, API y paquetes compartidos,
- flujo de admision y matricula operativo de punta a punta,
- configuracion academica operativa para ano, periodos, grados, cursos y materias,
- base inicial del modulo academico ya disponible para plan academico y notas.
