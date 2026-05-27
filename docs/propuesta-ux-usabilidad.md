# Propuesta UX y usabilidad

Fecha: 2026-05-25

## Estado de implementación

- `Inscripciones`: implementado el enfoque de bandeja diaria con tabs por estado, CTA principal y filtros avanzados colapsables.
- `Matrículas`: implementada la separación visual entre matrícula manual, continuidad y cierre anual, con acción recomendada por contexto.
- `Periodos`: implementada la vista de cierre guiado con acción principal por estado, checklist contextual y confirmaciones con impacto.
- `Boletines`: implementada la cola guiada por curso, con modos `individual`, `curso` y `listos para imprimir`.
- `Formulario de inscripción`: implementado el constructor guiado por pasos, con biblioteca de bloques y documentos sugeridos.
- `Navegación global`: implementada la reorganización por procesos y reforzada en sidebar y navegación móvil.
- `Sistema de modales`: implementado soporte reusable para tamaños y drawers, aplicado en flujos largos de inscripciones, matrículas y formularios.

## Objetivo

Hacer que los procesos ya construidos en OfirSchool sean más fáciles de ejecutar para usuarios reales del colegio, reduciendo:

- carga mental,
- cantidad de decisiones visibles por pantalla,
- dependencia de tablas y modales densos,
- y navegación pensada para el sistema en vez de para la tarea.

La meta no es quitar capacidad, sino esconder complejidad hasta que realmente haga falta.

## Principios de rediseño

### 1. Diseñar por tareas, no por tablas

El usuario piensa:

- abrir inscripciones,
- revisar aspirantes,
- matricular estudiantes,
- cerrar periodo,
- cerrar año,
- entregar boletines.

No piensa:

- administrar `admission_applications`,
- actualizar `periods`,
- o revisar `grade_records`.

### 2. Mostrar primero la siguiente acción útil

Cada pantalla debe responder:

- qué está pasando,
- qué me falta,
- qué puedo hacer ya,
- qué está bloqueado.

### 3. Menos modales, más flujos guiados

Los modales deben servir para acciones cortas.

Si la acción requiere:

- revisar contexto,
- tomar más de 5 decisiones,
- comparar datos,
- o confirmar impacto,

debe ir a:

- panel lateral grande,
- o vista tipo asistente.

### 4. Defaults inteligentes

Siempre que exista contexto activo, la UI debe precargar:

- año lectivo activo,
- periodo activo o más reciente,
- grupo actual filtrado,
- tipo de flujo,
- y acción recomendada.

### 5. Progresive disclosure

Primero se muestra lo mínimo necesario.

Luego, si el usuario quiere profundidad, se abren:

- filtros avanzados,
- auditoría,
- reglas,
- observaciones,
- detalles técnicos.

## Problemas actuales transversales

## Navegación

Archivo base:

- `apps/web/src/config/navigation.ts`
- `apps/web/src/components/Sidebar.vue`

Problema:

- la navegación sigue la estructura interna del producto,
- no las tareas del colegio,
- y hay demasiados puntos de entrada para procesos conectados.

Cambio propuesto:

- reorganizar la navegación principal en 5 bloques:
  - Inicio
  - Admisión y matrícula
  - Operación académica
  - Cierres y boletines
  - Institucional

Estructura sugerida:

- `Inicio`
- `Admisión y matrícula`
  - Inscripciones
  - Matrículas
  - Continuidad
- `Operación académica`
  - Asistencia
  - Actividades
  - Notas
  - Observaciones
  - Planes de apoyo
- `Cierres y boletines`
  - Periodos
  - Cierre anual
  - Boletines
- `Configuración`
  - Año lectivo
  - Grados y cursos
  - Materias
  - SIEE
  - Docentes

Resultado esperado:

- menos saltos entre pantallas,
- menor curva de aprendizaje,
- y mayor claridad de “dónde hago esta tarea”.

## Modales

Archivo base:

- `apps/web/src/components/FormModal.vue`

Problema:

- hoy el modal es único y simple,
- pero muchas tareas complejas dependen de él,
- lo que comprime demasiado formularios largos.

Cambio propuesto:

- soportar variantes:
  - `sm`
  - `md`
  - `lg`
  - `full`
- permitir encabezado con resumen de contexto,
- permitir footer fijo con acciones,
- permitir pasos.

Regla:

- menos de 6 campos: modal normal
- más de 6 campos o validación operativa: drawer o pantalla completa

## Layout y jerarquía visual

Archivos base:

- `apps/web/src/layouts/AppLayout.vue`
- `apps/web/src/styles.css`

Problema:

- hay mucho bloque visual con peso similar,
- todo compite por atención,
- y eso vuelve lenta la lectura.

Cambio propuesto:

- usar una estructura consistente:
  - encabezado
  - bloque de estado
  - acción principal
  - bandeja de trabajo
  - detalles secundarios

Regla:

- una sola acción primaria por pantalla,
- el resto como secundarias o contextuales.

## Propuesta pantalla por pantalla

## 1. Inscripciones

Archivo base:

- `apps/web/src/views/AdmissionsView.vue`

### Problemas actuales

- mezcla configuración del proceso con operación diaria,
- muestra muchos KPI y cajas antes de llegar a la tarea principal,
- la bandeja tiene demasiadas acciones visibles por fila,
- y revisar un aspirante compite con configurar el flujo.

### Qué dejar

- KPIs del embudo
- checklist de alistamiento
- bandeja principal
- conversión a matrícula

### Qué quitar de la vista principal

- configuración detallada del proceso como acción dominante,
- exceso de métricas redundantes,
- demasiados botones por fila.

### Qué mover

- `Configurar proceso` a una subvista o panel lateral dedicado
- `Editar formulario` como acción contextual dentro del proceso, no dentro de la bandeja

### Qué convertir en flujo guiado

- revisión de solicitud:
  1. ver datos fijos,
  2. revisar documentos,
  3. registrar decisión,
  4. convertir a matrícula si aplica.

### Rediseño propuesto

- tabs de bandeja:
  - Nuevas
  - En revisión
  - Aprobadas
  - Rechazadas
  - Convertidas

- CTA principal:
  - `Revisar solicitudes pendientes`

- CTA secundaria:
  - `Configurar proceso`

### Resultado esperado

- menos tiempo buscando estados,
- menos clics para procesar aspirantes,
- y más claridad operativa para secretaría.

## 2. Matrículas

Archivo base:

- `apps/web/src/views/EnrollmentsView.vue`

### Problemas actuales

- concentra creación, continuidad y cierre anual en una sola vista,
- tiene mucha densidad operativa,
- y mezcla decisiones de naturaleza muy distinta.

### Qué dejar

- métricas globales del año activo
- bandeja de matrículas
- continuidad masiva
- cierre anual

### Qué separar

Tres subflujos distintos:

- `Crear matrícula`
- `Continuidad masiva`
- `Cierre anual`

### Qué convertir en wizard

#### Continuidad masiva

1. Seleccionar cohorte
2. Revisar elegibles y bloqueados
3. Asignar grupos
4. Confirmar lote
5. Ver resultado

#### Cierre anual

1. Cargar cohorte
2. Revisar sugerencias automáticas
3. Ajustar excepciones
4. Aplicar decisiones
5. Ir a boletines finales

### Qué quitar del home de matrícula

- información duplicada entre cards y bandeja,
- exceso de paneles “resumen” si no ayudan a la acción inmediata.

### Resultado esperado

- menos sensación de “pantalla monstruo”,
- mejor comprensión del proceso,
- y menor riesgo de error en operaciones masivas.

## 3. Periodos

Archivo base:

- `apps/web/src/views/AcademicPeriodsView.vue`

### Problemas actuales

- la lógica ya está mejor,
- pero la UI sigue siendo una tabla administrativa,
- no una vista de “ciclo de cierre”.

### Qué dejar

- listado de periodos
- estado
- acciones de publicar, cerrar y reabrir

### Qué agregar

- timeline visual del periodo:
  - Abierto
  - Publicado
  - Cerrado

- checklist antes de publicar:
  - actividades creadas,
  - notas calculadas,
  - observaciones registradas,
  - estrategias de apoyo revisadas.

- checklist antes de cerrar:
  - boletines listos,
  - revisiones cerradas,
  - apoyos pendientes visibles.

### Qué cambiar

- en vez de botones iguales por fila, destacar una sola acción recomendada según estado.

Ejemplo:

- si está `open`: `Publicar periodo`
- si está `published`: `Cerrar periodo`
- si está `closed`: `Reabrir periodo`

### Resultado esperado

- cierre académico entendible,
- menos errores por transición,
- y más confianza para coordinación.

## 4. Boletines

Archivo base:

- `apps/web/src/views/ReportCardsView.vue`

### Problemas actuales

- ya mejoró mucho,
- pero aún depende de demasiada selección manual,
- y sigue siendo principalmente “consulta individual”.

### Qué dejar

- modo periodo
- modo anual
- impresión
- detalle por materia

### Qué agregar

- entrada desde contexto:
  - desde periodo cerrado
  - desde cierre anual
  - desde curso

- modo masivo:
  - boletines del curso
  - boletines listos para impresión
  - pendientes por completar

### Qué simplificar

- si el usuario viene desde `Cierre anual`, no pedir otra vez curso y estudiante desde cero.

### Resultado esperado

- menos selección repetitiva,
- mejor conexión entre cierre y salida documental,
- y entrega más fluida a coordinación.

## 5. Formulario de inscripción

Archivo base:

- `apps/web/src/views/EnrollmentFormsView.vue`

### Problemas actuales

- funcionalmente sirve,
- pero visualmente parece un editor técnico,
- no un constructor amigable para secretaría.

### Qué dejar

- secciones
- campos dinámicos
- documentos requeridos
- preview

### Qué cambiar fuerte

- pasar de “editor técnico de campos” a “constructor guiado”.

### Propuesta

- bloque inicial:
  - elegir plantilla base
  - definir nombre y vigencia

- biblioteca de bloques:
  - salud
  - acudientes
  - transporte
  - convivencia
  - autorizaciones

- acciones amigables:
  - duplicar sección
  - reordenar
  - sugerir campos comunes

- preview más cercana al formulario real

### Qué quitar

- decisiones técnicas visibles que el usuario no necesita entender.

### Resultado esperado

- menos miedo a editar,
- configuración más rápida,
- y menos dependencia del equipo técnico.

## Recomendaciones de interacción

## Acciones

- un botón primario por pantalla
- un botón primario por modal
- acciones destructivas siempre separadas

## Filtros

- filtro básico siempre visible
- filtros avanzados colapsables
- recordar último filtro por módulo

## Estados vacíos

Cada pantalla vacía debe decir:

- por qué no hay datos,
- qué falta configurar,
- y cuál es el siguiente paso.

## Confirmaciones

No usar confirmaciones genéricas tipo:

- “¿Deseas continuar?”

Usar confirmaciones con impacto:

- “Vas a cerrar el periodo 2. Después de esto no se podrán editar notas ni observaciones.”

## Errores

Los errores deben ser operativos, no técnicos.

Ejemplo:

- mal: “409 conflict”
- bien: “No puedes cerrar el periodo porque aún hay 12 planes de apoyo pendientes.”

## Orden de implementación UX

### Fase 1

- simplificar `Inscripciones`  `implementado`
- separar mejor `Matrículas`  `implementado`
- mejorar acciones contextuales de `Periodos`  `implementado`

### Fase 2

- rediseñar `Boletines`  `implementado`
- convertir `Continuidad masiva` en wizard
- convertir `Cierre anual` en wizard

### Fase 3

- rediseñar `Formulario de inscripción`  `implementado`
- reorganizar navegación global  `implementado`
- mejorar sistema de modales y drawers  `implementado`

## Quick wins

Cambios de alto impacto y bajo costo:

- resaltar una sola acción principal por pantalla,
- mover filtros avanzados a un colapsable,
- convertir botones por fila en un menú de acciones,
- reemplazar textos técnicos por textos operativos,
- precargar más contexto activo,
- y abrir detalles en panel lateral en vez de saturar la tabla.

## Criterio de éxito

La UI mejora si logramos que un usuario nuevo pueda:

1. abrir inscripciones sin capacitación larga,
2. revisar y aprobar aspirantes sin perderse,
3. matricular una cohorte sin miedo,
4. cerrar un periodo sabiendo qué está bloqueando,
5. decidir promoción con argumentos visibles,
6. y generar boletines sin repetir filtros innecesarios.
