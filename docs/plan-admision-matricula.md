# Plan del modulo de admision y matricula

Fecha: 2026-07-11

## Objetivo

Llevar el modulo de admision y matricula a un nivel usable por colegios en Colombia, con trazabilidad administrativa, seguridad de datos, soporte documental y base suficiente para conciliacion con procesos oficiales.

Este documento es un checklist de seguimiento. Marcar cada punto solo cuando exista implementacion, validacion funcional y evidencia minima.

## Estado actual resumido

- [x] Formulario publico por colegio y ano lectivo.
- [x] Ventana de apertura y cierre para inscripciones.
- [x] Version publicada del formulario dinamico.
- [x] Bandeja administrativa de solicitudes.
- [x] Estados basicos de admision: `submitted`, `reviewing`, `accepted`, `rejected`, `converted`.
- [x] Registro manual de aspirantes.
- [x] Conversion de admision aprobada a matricula.
- [x] Matricula manual de estudiantes.
- [x] Candidatos elegibles para matricula.
- [x] Continuidad masiva entre anos lectivos.
- [x] Validacion basica de grado, grupo, ano y cupos.
- [x] Cierre anual con decision de promocion.

## Prioridad 0: seguridad y datos antes de uso real

### Aislamiento y permisos

- [x] Validar que el `tenantId` efectivo venga de sesion/token confiable y no de headers controlables desde el navegador.
- [x] Validar `branchId` contra permisos reales del usuario antes de filtrar admisiones.
- [x] Validar `branchId` contra permisos reales del usuario antes de filtrar matriculas.
- [x] Aplicar la misma regla de sede en lectura de detalle de admision.
- [x] Aplicar la misma regla de sede en conversion de admision a matricula.
- [x] Aplicar la misma regla de sede en creacion manual de admision.
- [x] Aplicar la misma regla de sede en creacion manual de matricula.
- [x] Registrar en auditoria los accesos a documentos cargados.
- [x] Restringir descarga de documentos segun rol, sede y permiso especifico.

### Formulario publico

- [x] Agregar rate limiting por IP/colegio/ruta al envio publico.
- [x] Agregar proteccion anti abuso para el formulario publico.
- [x] Validar tamano total acumulado de archivos por solicitud.
- [x] Validar extension y MIME real de archivos cargados.
- [x] Generar checksum de archivos y guardarlo en `uploaded_documents`.
- [x] Definir politica de almacenamiento: ruta, retencion, borrado y acceso.
- [x] Evitar que un envio publico sobrescriba datos maestros verificados de un estudiante existente.

### Consolidacion de datos

- [x] Crear estado intermedio de aspirante o perfil provisional antes de consolidar en `students`.
- [x] Consolidar datos maestros del estudiante solo al aprobar o convertir a matricula.
- [x] Evitar que datos publicos no verificados actualicen acudientes existentes sin revision.
- [x] Detectar posibles duplicados por documento, nombre, fecha de nacimiento y acudiente.
- [x] Mostrar alertas de duplicado antes de aprobar una solicitud.

## Prioridad 1: consentimiento y cumplimiento de datos personales

### Autorizaciones

- [x] Crear tabla o entidad de consentimientos versionados.
- [x] Registrar version del aviso de privacidad aceptado.
- [x] Registrar version de autorizacion de tratamiento de datos.
- [x] Guardar fecha, canal, IP, actor y texto aceptado.
- [x] Asociar consentimiento a estudiante, acudiente, formulario y solicitud.
- [x] Permitir consultar evidencia de consentimiento desde el expediente de admision.
- [x] Permitir revocacion o registro de solicitudes de titulares.

### Menores de edad

- [x] Identificar representante legal o acudiente que autoriza.
- [x] Separar acudiente academico, representante legal y responsable financiero.
- [x] Registrar parentesco con catalogo controlado.
- [x] Permitir mas de un acudiente por estudiante desde admision.
- [x] Marcar acudiente principal, contactos de emergencia y autorizados para recoger.

### Datos sensibles

- [x] Clasificar campos sensibles: salud, discapacidad, convivencia, documentos y finanzas.
- [x] Definir permisos por tipo de dato, no solo por modulo.
- [x] Ocultar o enmascarar datos sensibles para roles sin autorizacion.
- [x] Registrar auditoria de lectura para datos sensibles.

## Prioridad 2: admision como proceso administrativo completo

### Estados y flujo

- [x] Agregar estado `document_review`.
- [x] Agregar estado `needs_correction` para subsanacion documental.
- [x] Agregar estado `interview_scheduled`.
- [x] Agregar estado `evaluated` o `committee_review`.
- [x] Agregar estado `waitlisted`.
- [x] Agregar estado `accepted_conditional`.
- [x] Definir transiciones permitidas entre todos los estados.
- [x] Bloquear conversion a matricula si hay documentos obligatorios pendientes.
- [x] Bloquear conversion a matricula si falta consentimiento obligatorio.

### Decision y trazabilidad

- [x] Reemplazar notas libres como unica evidencia por causales estructuradas.
- [x] Hacer obligatoria causal al rechazar.
- [x] Hacer obligatoria observacion al aceptar condicionado.
- [x] Registrar responsable asignado de la solicitud.
- [x] Registrar historial de cada cambio de estado.
- [x] Mostrar timeline del proceso en el detalle.
- [x] Permitir comentarios internos separados de observaciones visibles a familia.
- [x] Permitir adjuntar evidencia interna a la decision.

### Revision documental

- [x] Crear vista de documentos por solicitud.
- [x] Permitir aprobar documento.
- [x] Permitir rechazar documento con causal.
- [x] Permitir solicitar recarga o correccion.
- [x] Registrar fecha, revisor y motivo por documento.
- [x] Mostrar checklist documental por grado/tipo de ingreso.
- [x] Evitar aceptar solicitud con documentos obligatorios rechazados o faltantes.

### Comunicacion con familias

- [x] Crear plantillas de correo/mensaje para recibido, subsanacion, aceptacion, rechazo y matricula.
- [x] Registrar historial de comunicaciones enviadas.
- [x] Permitir reenviar enlace o instrucciones de subsanacion.
- [x] Separar comunicaciones internas y externas.

## Prioridad 3: matricula real para colegio privado

### Datos de matricula

- [x] Crear consecutivo o numero interno de matricula.
- [x] Registrar jornada.
- [x] Registrar sede de matricula de forma explicita.
- [x] Registrar fecha de firma o formalizacion.
- [x] Registrar estado documental de matricula.
- [x] Registrar estado financiero de matricula.
- [x] Registrar estado academico de ubicacion.
- [x] Separar `draft`, `pending_documents`, `pending_payment`, `active`, `cancelled`, `withdrawn`.

### Contratos y documentos

- [x] Generar contrato de matricula desde plantilla.
- [x] Registrar aceptacion del manual de convivencia.
- [x] Registrar aceptacion del SIEE vigente.
- [x] Registrar aceptacion de politicas de datos.
- [x] Registrar pagare, autorizaciones y anexos cuando aplique.
- [x] Guardar version de cada documento aceptado.
- [x] Permitir descargar constancia de matricula.
- [x] Agregar codigo de validacion o QR a documentos emitidos.

### Responsable financiero

- [x] Crear responsable financiero separado del acudiente principal.
- [x] Registrar tipo y numero de documento del responsable financiero.
- [x] Registrar datos de contacto y direccion de facturacion.
- [x] Asociar responsable financiero a contrato/matricula.
- [x] Preparar integracion futura con cartera/facturacion.

### Novedades de matricula

- [x] Registrar retiro.
- [x] Registrar traslado.
- [x] Registrar cambio de grupo.
- [x] Registrar cambio de sede.
- [x] Registrar reingreso.
- [x] Registrar graduacion.
- [x] Registrar cancelacion con motivo y fecha.
- [x] Mantener historial de novedades por estudiante y ano lectivo.

## Prioridad 4: continuidad y cierre anual

### Continuidad masiva

- [x] Ejecutar continuidad en transaccion o con control de concurrencia por cupos.
- [x] Evitar sobrecupos cuando dos usuarios ejecuten lotes al tiempo.
- [x] Guardar simulacion usada para ejecutar el lote.
- [x] Registrar responsable, fecha y parametros del lote.
- [x] Permitir descargar reporte de creados y omitidos.
- [x] Permitir reintentar omitidos sin repetir los creados.

### Promocion

- [x] Asociar decision de promocion con acta o evidencia de comite.
- [x] Registrar motivo para no promocion.
- [x] Registrar motivo para promocion condicionada.
- [x] Registrar promocion anticipada con soporte.
- [x] Bloquear continuidad si falta decision de promocion cuando el flujo lo exija.
- [x] Mostrar advertencias claras si se promueve con materias perdidas o planes pendientes.

## Prioridad 5: datos Colombia y reportes de apoyo

### Catalogos

- [x] Normalizar tipos de documento Colombia y extranjeros.
- [x] Normalizar genero/sexo segun necesidad de reporte.
- [x] Agregar departamento y municipio.
- [x] Agregar lugar de expedicion de documento.
- [x] Agregar direccion estructurada.
- [x] Agregar institucion de procedencia.
- [x] Agregar calendario, jornada, zona, sector y grado equivalente para reportes.
- [x] Registrar codigo DANE de institucion y sede.

### Datos de estudiante

- [x] EPS.
- [x] Grupo sanguineo/RH como catalogo controlado.
- [x] SISBEN si el colegio lo requiere.
- [x] Condiciones medicas relevantes con permisos restringidos.
- [x] Informacion de discapacidad o ajustes razonables con acceso restringido.
- [x] Contactos de emergencia.
- [x] Autorizados para recoger al estudiante.

### Conciliacion oficial

- [x] Preparar export de apoyo para conciliacion SIMAT.
- [x] Preparar reporte de novedades de matricula.
- [x] Registrar evidencia de reporte oficial: fecha, responsable, archivo y observaciones.
- [x] Dejar texto claro en UI: OfirSchool apoya la conciliacion, no reemplaza sistemas oficiales.
- [x] Evitar usar cartera o deuda como bloqueo de reporte oficial.

## Prioridad 6: experiencia de usuario

### Expediente de aspirante

- [x] Crear vista de expediente con datos, documentos, estado, timeline y acciones.
- [x] Mostrar checklist de admision por solicitud.
- [x] Mostrar duplicados potenciales.
- [x] Mostrar consentimientos asociados.
- [x] Mostrar comunicaciones enviadas.
- [x] Mostrar accion recomendada segun estado.

### Bandejas

- [x] Agregar filtros por responsable.
- [x] Agregar filtros por sede.
- [x] Agregar filtros por tipo de ingreso.
- [x] Agregar filtros por estado documental.
- [x] Agregar filtros por rango de fechas.
- [x] Agregar export de bandeja de admisiones.
- [x] Implementar export real de matriculas.

### Matricula

- [x] Crear wizard de matricula con pasos: estudiante, ubicacion, acudientes, responsable financiero, documentos, confirmacion.
- [x] Mostrar disponibilidad de cupos en tiempo real.
- [x] Mostrar advertencias antes de matricular en estado activo.
- [x] Permitir editar matricula con auditoria.
- [x] Permitir cancelar o retirar matricula con flujo formal.

## Prioridad 7: pruebas y calidad

### Backend

- [x] Prueba: no se puede ver admision de otra sede sin permiso.
- [x] Prueba: no se puede matricular si el grupo no pertenece al grado.
- [x] Prueba: no se puede matricular si el grupo no pertenece al ano.
- [x] Prueba: no se puede superar cupo.
- [x] Prueba: no se puede convertir admision no aprobada.
- [x] Prueba: no se puede convertir dos veces la misma solicitud.
- [x] Prueba: no se puede crear doble matricula activa/no eliminada para el mismo ano.
- [x] Prueba: envio publico exige campos y documentos obligatorios.
- [x] Prueba: envio publico respeta ventana de apertura/cierre.
- [x] Prueba: consentimiento queda asociado a la solicitud.

### Frontend

- [x] Prueba o validacion manual de bandeja de admisiones.
- [x] Prueba o validacion manual de detalle de admision.
- [x] Prueba o validacion manual de aprobacion/rechazo.
- [x] Prueba o validacion manual de conversion a matricula.
- [x] Prueba o validacion manual de matricula manual.
- [x] Prueba o validacion manual de continuidad masiva.
- [x] Prueba o validacion manual de cierre anual.

### Build y mantenimiento

- [x] `pnpm build` debe pasar.
- [x] `pnpm typecheck` debe pasar.
- [x] CI debe ejecutar build y pruebas.
- [x] Documentar cambios relevantes en `docs/contexto-funcional.md`.

## Criterios para marcar una tarea como terminada

- [x] Tiene implementacion en backend cuando afecta reglas de negocio.
- [x] Tiene UI cuando afecta operacion diaria del colegio.
- [x] Tiene persistencia o evidencia auditable cuando hay decision administrativa.
- [x] Tiene permisos revisados por tenant, sede y rol.
- [x] Tiene prueba automatizada o validacion manual documentada.
- [x] No rompe build ni typecheck.
- [x] Queda documentado si cambia el flujo principal.

## Orden sugerido de ejecucion

1. Seguridad tenant/sede y permisos sobre documentos.
2. Consentimientos versionados y evidencia legal.
3. No sobrescribir datos maestros desde formulario publico.
4. Revision documental y causales estructuradas.
5. Expediente de aspirante.
6. Matricula con contrato, responsable financiero y estados reales.
7. Novedades de matricula y conciliacion oficial.
8. Continuidad con control de concurrencia.
9. Exports, reportes y mejoras de UX.
10. Pruebas automatizadas y CI.
