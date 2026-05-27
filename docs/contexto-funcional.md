# Contexto funcional

Documento de referencia rápida para retomar OfirSchool sin reconstruir el contexto desde cero.

## Resumen del estado actual

El proyecto ya tiene una base funcional para:

- admisión pública de estudiantes nuevos,
- revisión administrativa de inscripciones,
- conversión de admisión a matrícula,
- matrícula manual de estudiantes antiguos,
- continuidad masiva entre años lectivos,
- configuración académica base,
- materias por grado,
- plan académico con logros,
- libro de notas por curso, materia y periodo,
- boletines por periodo y boletines finales anuales,
- cierre de periodo con estados `open -> published -> closed`,
- cierre anual con decisión de promoción por estudiante,
- gestión base de docentes,
- asignación docente por curso y materia,
- definición de directores de grupo y coordinaciones,
- primeros módulos SIEE como áreas académicas, competencias y escalas.

## Procesos implementados

### Admisión e inscripción

- Existe formulario público por año lectivo.
- El formulario público solo debe operar sobre el año lectivo `activo`.
- Solo puede quedar publicado un formulario activo por módulo.
- La vista pública ya no debe usar borradores locales para reemplazar la versión publicada.
- La bandeja administrativa permite revisar, aceptar, rechazar y convertir inscripciones.
- Las decisiones de admisión ya soportan comentarios internos.

### Matrícula

- Se puede crear matrícula manual.
- Se puede convertir una admisión aprobada a matrícula.
- Existe continuidad masiva para promover o renovar estudiantes del año anterior.
- La continuidad masiva ya valida grado, grupo, año y cupos antes de crear.
- En continuidad masiva se puede elegir grupo destino por estudiante.
- La continuidad masiva ya muestra resumen académico anual por estudiante.
- El cierre anual permite revisar cohorte, sugerencia automática y guardar `promotionStatus`.

### Configuración académica

- Se administran años lectivos, periodos, grados y cursos.
- Los cursos quedan ligados a un grado y a un año lectivo.
- Se administran materias y áreas académicas.
- La asignación base de materias ahora es por `grado`, no por `curso`.

### Operación docente

- Existe catálogo de docentes con estado, especialidad e intensidad máxima semanal.
- El docente puede vincularse a un usuario real del sistema.
- La carga docente operativa se asigna por `curso + materia`.
- La carga semanal del docente se valida contra `maxWeeklyHours`.
- Los directores de grupo y coordinaciones se gestionan como responsabilidades docentes.

### Operación académica

- Existe módulo de asistencia por curso, materia y fecha.
- El plan académico maneja logros por año, grado, materia y periodo.
- El libro de notas trabaja por curso, materia y periodo.
- Al publicar un periodo se recalculan las notas finales del corte.
- Existen boletines por periodo y boletines finales anuales desde backoffice.
- Las materias visibles para notas y logros deben existir en la malla del grado correspondiente.

### Usabilidad operativa

- `Inscripciones` ya fue simplificado para priorizar la bandeja diaria, tabs por estado y una sola acción principal por aspirante.
- `Matrículas` ya separa mejor los flujos de matrícula manual, continuidad y cierre anual.
- `Inscripciones`, `Matrículas` y `Horarios` ahora siguen un patrón visual más liviano, cercano a `Estudiantes`: una sola franja de contexto arriba y el listado como protagonista.
- El sidebar ya no muestra la card de `Ruta sugerida` ni descripciones largas por bloque; además, la navegación ahora puede cargarse dinámicamente según roles desde backend/base de datos.
- Existe una vista administrativa `Menú y navegación` para crear/editar secciones e ítems del menú y definir qué roles ven cada opción.
- `Directores y coordinaciones` ya soporta coordinaciones con alcance `global`, `por nivel` o `por grado`, además de directores por curso.
- `Escalas y desempeños` ya permite asignar escalas por `nivel` o `grado` dentro de un año lectivo, preparando escenarios como preescolar cualitativo, primaria por letras y bachillerato numérico.
- La configuración de `Escalas y desempeños` ya ofrece plantillas explícitas de catálogo como `Numérica Colombia`, `Letras A-D` y `Preescolar logrado / no logrado`, para no construir todos los rangos manualmente desde cero.
- Existe un CRUD separado de `Niveles educativos` para declarar la oferta por `colegio / año lectivo / jornada`, independiente del catálogo permanente de `Grados`.
- `Libro de notas`, `boletines` y los cálculos de continuidad/promoción ya resuelven la escala aplicada por `grado -> nivel -> escala global`, en vez de depender siempre de una única escala institucional.
- `grade_records` ya guarda tanto el `score` numérico base como el `valor visible` de la calificación (`gradeValue`), lo que permite reflejar mejor escalas cualitativas o por letras en notas y boletines.
- `Calificador por actividad` también quedó alineado con esa lógica: usa la escala resuelta del curso y, cuando no es numérica, permite seleccionar directamente la valoración institucional.
- `Periodos` ya funciona como vista de cierre guiado, con acción recomendada, checklist contextual y confirmaciones con impacto.
- `Boletines` ya trabaja con modos `individual`, `curso` y `listos para imprimir`, apoyado en una cola de estudiantes por curso.
- `Formulario de inscripción` ya funciona como constructor guiado por pasos, con biblioteca de bloques y documentos sugeridos.
- La navegación principal ya está reorganizada por procesos: `Inicio`, `Admisión y matrícula`, `Operación académica`, `Cierres y cortes`, `Configuración` e `Institucional`.
- `FormModal` ya soporta tamaños `sm/md/lg/full` y presentación `modal/drawer`, y los flujos largos principales ya usan variantes amplias.
- El flujo de `Notas` ya muestra feedback visible cuando faltan filtros, el periodo está bloqueado, no hay calificaciones válidas o una acción no puede ejecutarse.
- El contexto académico ya expone `selectedYearNumber` y se corrigieron vistas que mezclaban `academicYearId` con `year` numérico al consultar estudiantes, admisiones o matrículas.

## Reglas funcionales clave

### Año lectivo

- Solo un año lectivo puede estar `activo`.
- Un año lectivo no puede activarse si la suma de pesos de sus periodos no da `100`.
- Si el año ya tiene operación asociada, se bloquean cambios estructurales como año y rango de fechas.

### Formularios de inscripción

- Los formularios deben quedar asociados a un año lectivo real.
- El formulario publicado debe corresponder al año lectivo `activo`.
- Si cambia el modelo de datos, hay que correr `pnpm db:migrate` antes de probar UI.

### Integridad académica

- No se deben eliminar años, grados o cursos que ya tengan uso operativo.
- Los cursos en uso no deben cambiar de grado o año de forma inconsistente.
- No se debe reducir la capacidad de un curso por debajo de su ocupación real.
- Un periodo `published` o `closed` no debe volver a editarse ni eliminarse desde UI.

### Malla académica

- La tabla activa para la asignación base de materias es `grade_subjects`.
- `course_subjects` puede seguir existiendo en algunas bases por compatibilidad histórica, pero no debe usarse como fuente vigente.
- Todos los cursos del mismo grado heredan la misma base de materias.
- La operación docente sí sigue usando asignaciones por `curso`, porque distintos grupos del mismo grado pueden tener docentes diferentes.

## Módulos y rutas relevantes

### Frontend

- `apps/web/src/views/AdmissionsView.vue`
- `apps/web/src/views/EnrollmentsView.vue`
- `apps/web/src/views/EnrollmentFormsView.vue`
- `apps/web/src/views/AcademicYearsView.vue`
- `apps/web/src/views/AcademicPeriodsView.vue`
- `apps/web/src/views/AcademicGradesView.vue`
- `apps/web/src/views/CoursesView.vue`
- `apps/web/src/views/SubjectsView.vue`
- `apps/web/src/views/CourseSubjectsView.vue`
- `apps/web/src/views/AcademicPlanView.vue`
- `apps/web/src/views/GradebookView.vue`
- `apps/web/src/views/CompetenciesView.vue`
- `apps/web/src/views/TeachersView.vue`
- `apps/web/src/views/TeacherAssignmentsView.vue`
- `apps/web/src/views/TeacherResponsibilitiesView.vue`
- `apps/web/src/views/SchedulesView.vue`
- `apps/web/src/lib/api.ts`
- `apps/web/src/router/index.ts`
- `apps/web/src/config/navigation.ts`

### Backend

- `apps/api/src/routes/public-admissions.ts`
- `apps/api/src/routes/admissions.ts`
- `apps/api/src/routes/enrollments.ts`
- `apps/api/src/routes/enrollment-forms.ts`
- `apps/api/src/routes/academic.ts`

### Base de datos y contratos

- `packages/db/src/schema.ts`
- `packages/db/src/seed.ts`
- `packages/db/drizzle/0005_academic_program.sql`
- `packages/db/drizzle/0006_grade_subjects.sql`
- `packages/db/drizzle/0012_teacher_responsibilities.sql`
- `packages/db/drizzle/0013_academic_schedules.sql`
- `packages/db/drizzle/0014_journeys_by_level.sql`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/types.ts`

## Migraciones importantes

- `0005_academic_program.sql`
  Crea base para materias, logros y libro de notas.

- `0006_grade_subjects.sql`
  Introduce `grade_subjects` y mueve la asignación base de materias de curso a grado.

- `0012_teacher_responsibilities.sql`
  Introduce responsabilidades docentes para directores de grupo y coordinaciones.

- `0013_academic_schedules.sql`
  Introduce jornadas por año lectivo, franjas horarias por jornada, opciones de jornada por curso y horario generado por curso.

- `0014_journeys_by_level.sql`
  Permite segmentar jornadas por nivel académico y por grado específico.

## Seed demo

El seed principal en `packages/db/src/seed.ts` ya no deja solo un arranque mínimo.
Ahora prepara una base demo mucho más útil para pruebas integrales con:
- grados desde `Prejardín` hasta `Undécimo`,
- cursos `A`, `B` y `C`,
- materias y malla por grado según nivel,
- docentes con especialidad y carga docente,
- directores de grupo,
- jornadas y franjas por nivel,
- opciones de jornada por curso,
- competencias y logros sugeridos por periodo,
- estudiantes, acudientes y matrículas,
- actividades evaluativas, calificaciones, asistencia,
- observaciones académicas y planes de apoyo.

Esto deja el entorno listo para probar:
- horarios,
- libro de notas,
- boletines,
- cierre académico,
- y navegación operativa del colegio demo.

## Problemas ya detectados y resueltos

- El formulario público podía mezclar borradores locales con el formulario real publicado.
- La conversión a matrícula y la matrícula manual no validaban completamente grupo, grado, año y cupos.
- Había estados visuales de configuración que no se persistían realmente.
- `Materias por grado` podía fallar con `500` si no estaba aplicada la migración `0006_grade_subjects.sql`.
- `Competencias Académicas` tenía una carga incorrecta del catálogo de grados por usar un cliente API heredado.
- El módulo de docentes estaba iniciado en backend pero no tenía vistas reales ni responsabilidades institucionales en web.
- No existía todavía un modelo formal para jornadas, franjas y horario automático por curso.

## Avance reciente: horarios académicos

Ya quedó implementada la base backend para horarios académicos reutilizando la operación existente de:
- `course_subjects.weekly_hours`
- `course_subjects.teacher_id`
- `teachers.max_weekly_hours`
- `groups.academic_year_id`

### Modelo nuevo

- `academic_year_journeys`
  Jornadas por año lectivo y opcionalmente por sede.
  Ahora también pueden orientarse a:
  - todo el colegio,
  - un nivel (`preescolar`, `primaria`, `secundaria`, `media`),
  - o un grado específico.

- `academic_year_journey_slots`
  Franjas por jornada, día y orden de bloque.

- `group_journey_options`
  Permite que un curso tenga múltiples jornadas candidatas dentro del mismo año lectivo.

- `group_timetable_entries`
  Horario resultante por curso, jornada, día, bloque, materia y docente.

### API nueva

En `apps/api/src/routes/academic.ts` quedaron nuevos endpoints para:
- CRUD de `journeys`
- CRUD de `journey-slots`
- CRUD de `group-journey-options`
- consulta de `timetable`
- generación automática `POST /academic/timetable/generate`

### Regla actual del generador MVP

La generación actual:
- elige la jornada preferida del curso, o la de menor prioridad,
- respeta compatibilidad entre jornada y nivel/grado del curso,
- toma solo franjas `class`,
- reparte horas semanales desde `course_subjects`,
- evita doble ocupación del docente en el mismo bloque,
- evita doble ocupación del curso en el mismo bloque,
- deja el resultado en estado `draft`,
- y devuelve conflictos explícitos si faltan docentes, faltan opciones de jornada o no alcanzan los bloques.

### Límite actual

Ya existe una primera UI dedicada para administrar estos horarios en `apps/web/src/views/SchedulesView.vue`.
La vista cubre:
- configuración de jornadas,
- armado de franjas,
- asignación de jornadas candidatas por curso,
- generación de borrador,
- revisión de conflictos,
- consulta del horario generado.

### Avance adicional de fase 2

El módulo de horarios ya soporta además:
- filtro del horario por `docente`,
- ajuste manual de un bloque a otra franja o jornada válida,
- cambio masivo de estado `draft -> published -> locked`,
- y auditoría backend de estos cambios.

Además, la UI de `Horarios` ya deja crear jornadas diferenciadas para:
- `preescolar`,
- `primaria`,
- `secundaria`,
- `media / bachillerato`,
- o un grado puntual.

Esto quedó distribuido entre:
- `apps/api/src/routes/academic.ts`
- `apps/web/src/views/SchedulesView.vue`
- `apps/web/src/lib/api.ts`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/types.ts`

La navegación ya expone este módulo en:
- `apps/web/src/router/index.ts`
- `apps/web/src/config/navigation.ts`

### Límite actual de la UI

Aunque la operación base ya es usable, todavía falta una segunda fase visual para:
- ajuste manual de bloques tipo drag-and-drop,
- validaciones visuales por docente en paralelo,
- vistas por docente y por jornada,
- y reportes imprimibles por curso o sede.

## Pendientes naturales

### Académico

- profundizar SIEE: indicadores, escalas y reportes,
- acta final y exportables institucionales del cierre académico,
- posibles ajustes para que logros y competencias hereden mejor desde la malla del grado.
- ajuste manual avanzado de horarios y publicación final.

### Operación

- más validaciones sobre cierre o eliminación de periodos si ya hay notas asociadas,
- trazabilidad y auditoría más visible en UI,
- reportes operativos de admisión, matrícula y académico.

## Checklist rápido al retomar

1. correr `pnpm install`,
2. correr `pnpm db:migrate`,
3. levantar con `pnpm dev`,
4. validar que exista un año lectivo `activo`,
5. validar que los periodos del año activo sumen `100`,
6. validar que existan grados, cursos, materias y materias por grado,
7. recién después probar inscripción pública, plan académico o notas.
