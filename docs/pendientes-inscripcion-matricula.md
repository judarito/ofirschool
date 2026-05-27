# Pendientes priorizados: inscripciones y matrículas

Fecha: 2026-05-23

## Objetivo

Cerrar el flujo completo de:

- configuración académica previa,
- inscripción de alumnos nuevos,
- revisión administrativa,
- conversión a matrícula,
- matrícula manual,
- continuidad de alumnos antiguos.

## Prioridad 0: bloquear riesgos operativos

### 1. La vista pública no debe mezclar borradores locales con la versión publicada

Problema actual:

- la vista pública puede sobreescribir el formulario real con un borrador guardado en `localStorage`
- una familia puede ver una estructura distinta a la publicada

Acción:

- eliminar la sobreescritura automática del payload publicado
- dejar el borrador local solo para el editor interno
- si se quiere preview local, moverlo a una ruta de preview explícita solo para backoffice

Resultado esperado:

- el link público siempre muestra exactamente la versión publicada en backend

### 2. Validar consistencia académica al crear matrículas

Problema actual:

- matrícula manual y conversión desde admisión no validan que el grupo pertenezca al año y grado elegidos
- tampoco validan cupos antes de insertar

Acción:

- validar que `gradeId` exista y pertenezca al tenant
- validar que `groupId`, si viene, pertenezca al tenant, al año lectivo y al grado
- validar capacidad del grupo antes de crear matrícula
- aplicar estas reglas en:
  - `POST /api/enrollments`
  - `POST /api/admissions/applications/:id/convert-to-enrollment`
  - continuidad masiva, reutilizando la misma lógica

Resultado esperado:

- no se crean matrículas académicamente inválidas

### 3. Hacer reales los estados de configuración previa

Problema actual:

- la UI deja elegir estados como `cerrado` o `inactivo`
- backend no persiste esos estados de forma real en grados y cursos
- en años lectivos solo se refleja `activo` o `planeado`

Acción:

- definir el modelo real de estados para:
  - años lectivos
  - grados
  - cursos
- alinear esquemas, DTOs, rutas y vistas
- evitar ofrecer opciones no soportadas

Resultado esperado:

- la configuración previa refleja el estado operativo real

## Prioridad 1: cerrar trazabilidad administrativa

### 4. Agregar causal o comentario estructurado al aprobar y rechazar inscripciones

Problema actual:

- backend soporta `notes`
- la UI no obliga ni facilita capturar motivo operativo

Acción:

- añadir modal o formulario corto para transición de estado
- capturar:
  - comentario interno
  - causal de rechazo
  - observación de aprobación si aplica
- mostrar esas notas en el detalle de la solicitud

Resultado esperado:

- cada decisión de admisión queda trazable

### 5. Completar el registro operativo al convertir a matrícula

Problema actual:

- la conversión usa valores por defecto y no permite revisión del dato final
- no hay paso de confirmación con grado, curso, estado y fecha

Acción:

- abrir modal de conversión desde admisiones
- permitir ajustar:
  - grado destino
  - grupo destino
  - estado inicial
  - fecha de matrícula
- validar en backend igual que la matrícula manual

Resultado esperado:

- la conversión deja de ser una acción ciega

## Prioridad 2: robustecer configuración previa

### 6. Conectar el editor de formulario a años lectivos reales

Problema actual:

- el editor de formulario tiene años fijos en UI

Acción:

- cargar años lectivos desde API
- usar el año seleccionado en el contexto académico o un selector real
- bloquear edición si el año no existe

Resultado esperado:

- el formulario público se administra sobre catálogos reales

### 7. Validar reglas de integridad académica

Acción:

- validar que `startsOn <= endsOn` en años y periodos
- validar que cada periodo quede dentro del año lectivo
- validar que la suma de pesos por año no exceda 100
- idealmente exigir 100 al cerrar la configuración anual

Resultado esperado:

- la base académica queda coherente antes de operar admisiones y matrículas

### 8. Evitar borrar configuración en uso

Acción:

- bloquear eliminación de:
  - años lectivos con periodos, cursos, inscripciones o matrículas
  - grados usados por cursos, inscripciones o matrículas
  - cursos usados por inscripciones o matrículas
- si no se puede borrar, ofrecer inactivación

Resultado esperado:

- se evita romper trazabilidad histórica

## Prioridad 3: completar continuidad y operación anual

### 9. Mejorar continuidad masiva

Acción:

- permitir asignar grupo destino
- validar cupos por grupo antes de ejecutar
- mostrar simulación:
  - total elegibles
  - sin cupo
  - con conflicto
  - listos para crear
- distinguir claramente `promotion` y `auto_promotion` si el negocio realmente los diferencia

Resultado esperado:

- continuidad masiva utilizable en operación real

### 10. Afinar matrícula manual de alumnos antiguos

Acción:

- sugerir mejor grado destino según historial
- restringir tipos de matrícula inconsistentes
- opcionalmente mostrar advertencias por:
  - última matrícula cancelada
  - varios años sin continuidad
  - estudiante proveniente de transferencia

Resultado esperado:

- menos errores manuales al matricular antiguos

## Prioridad 4: visibilidad y control

### 11. Reportes de embudo de inscripción

Acción:

- exponer métricas por estado:
  - `submitted`
  - `reviewing`
  - `accepted`
  - `converted`
  - `rejected`
- permitir filtrar por año, grado y fecha

Resultado esperado:

- mejor lectura operativa del proceso de admisión

### 12. Checklist de alistamiento por año lectivo

Acción:

- construir una vista de preparación anual que indique si ya existen:
  - año lectivo
  - periodos
  - grados
  - cursos
  - formulario publicado
  - ventana pública configurada

Resultado esperado:

- el colegio sabe cuándo está realmente listo para abrir inscripciones

## Orden recomendado de implementación

1. Corregir vista pública para que no use borradores locales sobre la versión publicada.
2. Unificar validaciones de matrícula manual, conversión y continuidad.
3. Alinear estados reales de años, grados y cursos.
4. Agregar modal con causal/nota para aprobar y rechazar inscripciones.
5. Crear modal de conversión a matrícula desde admisiones.
6. Conectar editor de formulario a años lectivos reales.
7. Añadir validaciones de integridad en configuración académica.
8. Bloquear eliminación de configuración en uso.
9. Mejorar continuidad masiva con grupos y cupos.
10. Añadir checklist de alistamiento y métricas de embudo.

## Siguiente sprint sugerido

Sprint 1:

- corregir vista pública
- validar creación de matrículas
- modal de conversión desde admisiones

Sprint 2:

- trazabilidad de aprobación/rechazo
- estados reales de configuración
- años lectivos reales en editor de formulario

Sprint 3:

- continuidad masiva con cupos y grupos
- checklist anual
- reportes de embudo
