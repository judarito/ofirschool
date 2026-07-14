# Plan: Procesos en lote asincronos

## Objetivo

Mover los procesos en lote criticos a una arquitectura asincrona basada en jobs y worker(s), para que la app siga respondiendo en momentos de alta carga como inicio y fin de ano escolar.

El objetivo tecnico es garantizar:

- [ ] Atomicidad segun el tipo de proceso.
- [ ] Idempotencia ante reintentos, doble clic o reenvio de la misma solicitud.
- [ ] Resiliencia ante fallos del servidor, caidas del worker o errores parciales.
- [ ] Escalabilidad mediante colas, workers separados y limites de concurrencia.
- [ ] Trazabilidad del estado, progreso, errores y resultado final.

## Procesos candidatos

- [ ] Continuidad masiva / promocion de matriculas.
- [ ] Cierre anual / decisiones de promocion.
- [ ] Recalculo automatico de notas por periodo.
- [ ] Carga masiva de notas por planilla.
- [ ] Carga masiva de asistencia.
- [ ] Calificaciones por actividad evaluativa.
- [ ] Otros procesos futuros de importacion/exportacion masiva.

## Decision de arquitectura

- [ ] Elegir motor de cola.
  - Recomendado inicial: cola respaldada por Postgres.
  - Opciones: `pg-boss`, `Graphile Worker`.
  - Alternativa futura: BullMQ + Redis si la carga justifica infraestructura adicional.
- [ ] Crear un proceso separado `apps/worker`.
- [ ] Mantener el API enfocado en validar, crear jobs y responder rapido.
- [ ] Mover la ejecucion pesada al worker.
- [ ] Definir limites de concurrencia por tipo de job, tenant y ano lectivo.

## Modelo de datos

### Tabla `batch_jobs`

- [ ] Crear migracion para `batch_jobs`.
- [ ] Campos base:
  - [ ] `id`
  - [ ] `tenant_id`
  - [ ] `type`
  - [ ] `status`
  - [ ] `progress_total`
  - [ ] `progress_done`
  - [ ] `payload`
  - [ ] `result`
  - [ ] `error`
  - [ ] `idempotency_key`
  - [ ] `created_by`
  - [ ] `started_at`
  - [ ] `finished_at`
  - [ ] `created_at`
  - [ ] `updated_at`

### Tabla `batch_job_items`

- [ ] Crear migracion para `batch_job_items`.
- [ ] Usarla para lotes con muchos registros o errores por item.
- [ ] Campos base:
  - [ ] `id`
  - [ ] `job_id`
  - [ ] `entity_id`
  - [ ] `status`
  - [ ] `attempts`
  - [ ] `result`
  - [ ] `error`
  - [ ] `created_at`
  - [ ] `updated_at`

## Estados de job

- [ ] `queued`: creado y pendiente de ejecucion.
- [ ] `running`: tomado por un worker.
- [ ] `completed`: terminado correctamente.
- [ ] `failed`: fallo definitivo.
- [ ] `partially_failed`: termino con errores por item.
- [ ] `cancelled`: cancelado antes o durante la ejecucion, si el proceso lo permite.

## Idempotencia

- [ ] Definir formato de `idempotency_key`.
- [ ] Incluir al menos:
  - [ ] `tenant_id`
  - [ ] tipo de proceso
  - [ ] ano/periodo academico cuando aplique
  - [ ] hash estable del payload normalizado
- [ ] Agregar constraint unica sobre `tenant_id + type + idempotency_key`.
- [ ] Si llega la misma solicitud:
  - [ ] No crear otro job.
  - [ ] Devolver el job existente.
  - [ ] Mantener respuesta consistente para la UI.
- [ ] Mantener idempotencia por regla de negocio:
  - [ ] Matricula destino por estudiante y ano lectivo.
  - [ ] Decision de promocion por matricula.
  - [ ] Asistencia por estudiante, fecha, materia y periodo.
  - [ ] Nota por estudiante, materia y periodo.
  - [ ] Nota de actividad por estudiante y actividad.

## Atomicidad

- [ ] Clasificar cada proceso por estrategia de atomicidad.

### Atomicidad total

Aplica cuando un resultado parcial puede dejar el ano escolar inconsistente.

- [ ] Cierre anual / decisiones de promocion.
- [ ] Continuidad masiva si el usuario espera "todo o nada".
- [ ] Recalculo automatico de notas por curso/materia/periodo.

Reglas:

- [ ] Validar todo antes de escribir.
- [ ] Ejecutar escrituras y auditoria en transaccion.
- [ ] Si falla una parte, revertir todo.

### Atomicidad por item

Aplica cuando es mejor avanzar con registros validos y reportar errores especificos.

- [ ] Carga masiva de asistencia.
- [ ] Carga masiva de notas.
- [ ] Calificaciones por actividad.

Reglas:

- [ ] Registrar estado por item.
- [ ] Reintentar items fallidos cuando sea seguro.
- [ ] Reportar errores accionables al usuario.
- [ ] Evitar duplicados con claves de negocio.

## Resiliencia

- [ ] Configurar reintentos automaticos.
- [ ] Usar backoff exponencial o incremental.
- [ ] Definir maximo de intentos por tipo de job.
- [ ] Registrar error tecnico y mensaje de negocio.
- [ ] Marcar jobs como fallidos despues del ultimo intento.
- [ ] Permitir reintento manual cuando aplique.
- [ ] Evitar que un worker procese dos veces el mismo job mediante locks del motor de cola.
- [ ] Soportar recuperacion si el worker cae a mitad del proceso.

## Concurrencia y limites

- [ ] Definir concurrencia global de workers.
- [ ] Definir concurrencia por tipo de job.
- [ ] Definir locks por tenant y periodo/ano.
- [ ] Evitar dos cierres anuales simultaneos para el mismo `tenant_id + academic_year_id`.
- [ ] Evitar dos continuidades masivas simultaneas para el mismo ano destino.
- [ ] Limitar recalculos simultaneos por `tenant_id + academic_period_id`.
- [ ] Priorizar jobs interactivos pequenos sobre procesos largos cuando sea necesario.

## API

- [ ] Crear endpoint `POST /batch-jobs`.
- [ ] Crear endpoint `GET /batch-jobs/:id`.
- [ ] Crear endpoint `GET /batch-jobs`.
- [ ] Crear endpoint `POST /batch-jobs/:id/cancel`, si aplica.
- [ ] Crear endpoint `POST /batch-jobs/:id/retry`, si aplica.
- [ ] Cambiar endpoints de lote para responder `202 Accepted`.
- [ ] Respuesta base:

```json
{
  "jobId": "uuid",
  "status": "queued"
}
```

## Actualizaciones en tiempo real

Para informar progreso a la UI, usar un canal servidor -> cliente. La recomendacion inicial es **SSE (Server-Sent Events)** porque el progreso de jobs no necesita comunicacion bidireccional permanente.

- [ ] Definir canal inicial: SSE.
- [ ] Crear endpoint `GET /batch-jobs/:id/events`.
- [ ] Emitir eventos cuando cambie el estado del job.
- [ ] Mantener endpoint `GET /batch-jobs/:id` como fuente de verdad y fallback.
- [ ] Agregar polling de respaldo si el navegador pierde la conexion SSE.
- [ ] Cerrar la conexion SSE cuando el job termine.
- [ ] Reintentar conexion automaticamente desde la UI si se interrumpe.

Eventos propuestos:

- [ ] `queued`
- [ ] `running`
- [ ] `progress`
- [ ] `completed`
- [ ] `failed`
- [ ] `partially_failed`
- [ ] `cancelled`

Payload propuesto:

```json
{
  "jobId": "uuid",
  "type": "annual_promotion",
  "status": "running",
  "progressTotal": 1000,
  "progressDone": 250,
  "message": "Procesando matriculas",
  "result": null,
  "error": null
}
```

### WebSocket como alternativa futura

Usar WebSocket si mas adelante necesitamos:

- [ ] Un centro global de notificaciones en vivo para todos los jobs del usuario.
- [ ] Una sola conexion para multiples jobs activos.
- [ ] Comunicacion bidireccional en tiempo real.
- [ ] Cancelar, pausar o priorizar jobs desde el mismo canal.
- [ ] Eventos de colaboracion o cambios academicos en vivo fuera de procesos en lote.

## Worker

- [ ] Crear paquete/app `apps/worker`.
- [ ] Conectar el worker a la base de datos.
- [ ] Conectar el worker al motor de cola.
- [ ] Implementar handler por tipo de job.
- [ ] Compartir logica de negocio con el API sin duplicar reglas.
- [ ] Agregar logs estructurados por `jobId`, `tenantId` y `type`.
- [ ] Agregar apagado controlado para no cortar jobs a mitad.

## Migracion de procesos

### Fase 1: Base de infraestructura

- [ ] Crear tablas `batch_jobs` y `batch_job_items`.
- [ ] Elegir e instalar motor de cola.
- [ ] Crear `apps/worker`.
- [ ] Crear servicio interno de jobs.
- [ ] Crear endpoints de consulta de jobs.
- [ ] Crear componente UI generico de progreso de jobs.

### Fase 2: Cierre anual

- [ ] Migrar `annual-promotion-decisions` a job asincrono.
- [ ] Agregar lock por `tenant_id + academic_year_id`.
- [ ] Mantener atomicidad total.
- [ ] Mostrar progreso y resultado en UI.
- [ ] Mostrar errores por matricula si falla validacion previa.

### Fase 3: Continuidad masiva

- [ ] Migrar `continuity-batch` a job asincrono.
- [ ] Agregar lock por ano destino.
- [ ] Mantener idempotencia por estudiante y ano destino.
- [ ] Decidir si sera atomicidad total o por item.
- [ ] Mostrar creadas, omitidas y rechazadas.

### Fase 4: Recalculo de notas

- [ ] Migrar `gradebook-calculate` a job asincrono.
- [ ] Agregar lock por `tenant_id + academic_period_id + group_id + subject_id`.
- [ ] Mantener atomicidad total por curso/materia/periodo.
- [ ] Registrar resumen de notas recalculadas.

### Fase 5: Notas y asistencia masiva

- [ ] Evaluar si deben migrar completo a cola o mantenerse sincronos con transaccion.
- [ ] Migrar si el volumen real lo exige.
- [ ] Usar atomicidad por item si conviene a la operacion diaria.
- [ ] Permitir reintento de items fallidos.

## UI

- [ ] Mostrar estado del job despues de ejecutar una accion masiva.
- [ ] Evitar doble envio usando `jobId` e idempotency key.
- [ ] Permitir salir de la pantalla sin perder el seguimiento.
- [ ] Agregar centro o panel de procesos.
- [ ] Suscribirse por SSE al job activo.
- [ ] Actualizar progreso en pantalla sin recargar.
- [ ] Usar polling como fallback si SSE falla.
- [ ] Mostrar progreso: pendientes, procesados, fallidos.
- [ ] Mostrar resultado final con acciones siguientes.
- [ ] Mostrar errores accionables por item.
- [ ] Notificar cuando el job termina.

## Observabilidad

- [ ] Registrar duracion por tipo de job.
- [ ] Registrar cantidad de jobs en cola.
- [ ] Registrar jobs fallidos por tipo.
- [ ] Registrar tiempo promedio en cola.
- [ ] Registrar intentos por job.
- [ ] Agregar limpieza de jobs antiguos.
- [ ] Definir alertas para jobs atascados.

## Criterios de aceptacion

- [ ] Ningun proceso masivo critico depende de una peticion HTTP larga.
- [ ] Reintentar la misma solicitud no duplica datos.
- [ ] Si un job falla, el usuario puede ver que fallo y por que.
- [ ] Si el worker cae, el job queda recuperable.
- [ ] El cierre anual no puede ejecutarse dos veces al mismo tiempo para el mismo ano.
- [ ] La continuidad masiva no puede crear matriculas duplicadas.
- [ ] La UI muestra progreso y no deja al usuario presionando botones a ciegas.
- [ ] La UI recibe actualizaciones de progreso por SSE o fallback de polling.
- [ ] Hay auditoria de inicio, fin y resultado del proceso.

## Pendientes de decision

- [ ] Confirmar motor de cola: `pg-boss`, `Graphile Worker` o BullMQ + Redis.
- [ ] Confirmar si iniciamos con SSE o WebSocket.
- [ ] Confirmar si continuidad masiva debe ser "todo o nada" o por item.
- [ ] Confirmar tiempo de retencion de jobs completados.
- [ ] Confirmar si se permitira cancelar jobs en ejecucion.
- [ ] Confirmar prioridades entre procesos administrativos y procesos academicos diarios.
