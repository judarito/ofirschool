# Contexto de trabajo: inscripciones y matrículas

Fecha de actualización: 2026-05-20

## Objetivo de esta iteración

Cerrar el flujo operativo de:

- inscripción de alumnos nuevos,
- revisión y aprobación administrativa,
- conversión segura a matrícula,
- matrícula manual de alumnos antiguos con trazabilidad de continuidad.

## Estado actual del proceso

### Alumnos nuevos

Flujo implementado:

1. El colegio configura el proceso público por año lectivo desde `Inscripciones`.
2. El formulario dinámico se publica desde `Formularios`.
3. La familia diligencia `/inscripcion/:tenantSlug/:year`.
4. El backend crea o reutiliza estudiante y acudiente, registra la solicitud y guarda respuestas y documentos.
5. El equipo administrativo cambia el estado de la solicitud:
   - `submitted -> reviewing`
   - `submitted/reviewing/rejected -> accepted`
   - `submitted/reviewing/accepted -> rejected`
6. Solo las solicitudes `accepted` se pueden convertir a matrícula.

### Alumnos antiguos

Flujo implementado:

1. El módulo `Matrículas` ya no usa el listado de estudiantes del año activo.
2. Ahora consulta candidatos elegibles para el año objetivo.
3. Para cada candidato se expone su matrícula más reciente, si existe.
4. Si la matrícula nueva es `renewal`, `promotion`, `auto_promotion` o `transfer`, la UI envía `previousEnrollmentId`.
5. El backend valida que esa matrícula anterior:
   - exista,
   - pertenezca al mismo estudiante,
   - no sea del mismo año lectivo.

## Qué se implementó

### Backend

Archivos principales:

- `apps/api/src/routes/admissions.ts`
- `apps/api/src/routes/enrollments.ts`

Cambio aplicado:

- nuevo endpoint `PATCH /api/admissions/applications/:id/status`
- reglas explícitas de transición de estados de admisión
- conversión a matrícula bloqueada si la solicitud no está `accepted`
- validación previa para evitar matrícula duplicada al convertir
- deduplicación de acudiente en inscripción manual
- prevención de inscripción manual duplicada por estudiante y año
- endpoint `GET /api/enrollments/candidates` para elegibilidad de matrícula
- validación de `previousEnrollmentId` para renovaciones, promociones y traslados internos
- validación de `admissionApplicationId` cuando una matrícula manual se apoya en una admisión previa

### Frontend

Archivos principales:

- `apps/web/src/views/AdmissionsView.vue`
- `apps/web/src/views/EnrollmentsView.vue`
- `apps/web/src/lib/api.ts`

Cambio aplicado:

- la bandeja de inscripciones ahora permite pasar a revisión, aprobar y rechazar
- el botón de conversión a matrícula solo aparece para solicitudes aprobadas
- el detalle de la inscripción expone las mismas acciones operativas
- el alta manual de inscripción ahora permite distinguir:
  - `new_student`
  - `transfer`
  - `reentry`
- el alta manual de matrícula usa candidatos elegibles en lugar de estudiantes ya matriculados
- la matrícula manual ya referencia la matrícula anterior cuando aplica
- el módulo `Matrículas` ahora tiene una bandeja de `Continuidad masiva`
- la continuidad masiva permite:
  - previsualizar cohortes del año anterior
  - filtrar por grado de origen
  - sugerir grado destino según el modo
  - ejecutar renovaciones o promociones por lote

### Contratos compartidos

Archivos principales:

- `packages/shared/src/schemas.ts`
- `packages/shared/src/types.ts`

Cambio aplicado:

- nuevo schema `admissionStatusUpdateSchema`
- nuevo schema `enrollmentCandidateFiltersSchema`
- DTO `AdmissionStatusChangeResultDto`
- DTO `EnrollmentCandidateDto`
- `EnrollmentDto` ahora expone `previousEnrollmentId`

## Validaciones realizadas

Comando ejecutado:

```bash
pnpm -r typecheck
```

Resultado:

- `packages/shared` OK
- `packages/db` OK
- `apps/api` OK
- `apps/web` OK

## Reglas de negocio que quedan vigentes

- una solicitud convertida no puede volver a otros estados
- una solicitud no se convierte a matrícula sin aprobación previa
- un estudiante no puede tener más de una matrícula activa/no eliminada por año lectivo
- una renovación o promoción debe apuntar a una matrícula anterior real
- el flujo público sigue siendo solo para ingreso externo; continuidad interna se resuelve desde backoffice
- la continuidad masiva trabaja sobre la cohorte del año lectivo inmediatamente anterior
- `renewal` conserva grado; `promotion` y `auto_promotion` exigen grado distinto al anterior

## Pendientes recomendados

1. Permitir asignar grupo destino dentro del lote masivo.
2. Añadir simulación de cupos por curso antes de ejecutar continuidad.
3. Añadir comentarios internos o causal estructurada al rechazar una admisión.
4. Conectar reportes de embudo: `submitted`, `reviewing`, `accepted`, `converted`, `rejected`.

## Archivos tocados en esta sesión

- `packages/shared/src/schemas.ts`
- `packages/shared/src/types.ts`
- `apps/api/src/routes/admissions.ts`
- `apps/api/src/routes/enrollments.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/views/AdmissionsView.vue`
- `apps/web/src/views/EnrollmentsView.vue`
- `apps/web/src/lib/api.ts`

## Nota de continuidad

Si retomamos este frente luego, el siguiente paso recomendado es enriquecer la continuidad masiva con:

- asignación de grupo en destino,
- reglas de cupo,
- y confirmación por cohorte con más detalle académico.
