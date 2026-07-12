# Plan de operacion academica Colombia

Fecha: 2026-07-11

## Objetivo

Fortalecer los modulos de operacion academica de OfirSchool para que sean simples de usar por personal administrativo y docente, pero suficientemente completos para colegios en Colombia: SIEE, evaluacion, promocion, convivencia, inclusion, asistencia, boletines, cierres y reportes de apoyo.

Este documento es un plan vivo. Cada punto debe marcarse solo cuando exista implementacion funcional, persistencia, permisos, auditoria cuando aplique y validacion con datos demo.

## Alcance

- Evaluacion, calificaciones, escalas y SIEE.
- Periodos, cierres academicos y promocion.
- Boletines y documentos academicos.
- Asistencia y seguimiento.
- Convivencia escolar.
- Inclusion, ajustes razonables y PIAR.
- Reportes de apoyo para procesos oficiales.
- Experiencia de usuario para docentes, coordinadores y secretaria academica.

## Principios de diseno

- [ ] Usar interfaces estandar y faciles de reconocer: listados, filtros, paneles de detalle, acciones claras y formularios por pasos solo cuando el proceso lo necesite.
- [ ] Priorizar trazabilidad sobre captura libre: responsable, fecha, estado, motivo, evidencia y version.
- [ ] Separar datos academicos, convivenciales, financieros, medicos y de inclusion.
- [ ] Evitar que observaciones libres reemplacen decisiones formales.
- [ ] Mantener el lenguaje orientado a usuarios no tecnicos.
- [ ] No prometer reemplazo de plataformas oficiales; OfirSchool debe apoyar preparacion, conciliacion y evidencia.

## Estado funcional esperado

### SIEE y evaluacion

- [ ] SIEE versionado por ano lectivo.
- [ ] Registro de fecha de aprobacion, vigencia, responsable y documento soporte.
- [ ] Escalas de valoracion por nivel, grado o seccion.
- [ ] Soporte para preescolar cualitativo sin forzar notas numericas.
- [ ] Reglas configurables de ponderacion por periodo, area, asignatura o componente.
- [ ] Reglas de recuperacion, habilitacion, nivelacion y planes de apoyo.
- [ ] Historial auditable de cambios al SIEE.
- [ ] Vista clara para docentes: que deben calificar, que falta y que esta bloqueado.

### Notas y seguimiento academico

- [ ] Registro de actividades evaluativas por periodo.
- [ ] Calificaciones con estado: borrador, revisado, publicado y bloqueado.
- [ ] Observaciones academicas separadas de convivencia.
- [ ] Planes de apoyo por estudiante, asignatura y periodo.
- [ ] Evidencia de seguimiento: compromisos, fechas, responsables y resultados.
- [ ] Auditoria de cambios de notas con motivo obligatorio.
- [ ] Alertas para notas faltantes antes del cierre de periodo.

### Comites de evaluacion y promocion

- [ ] Crear comites por periodo o cierre anual.
- [ ] Registrar asistentes, roles, agenda y estudiantes revisados.
- [ ] Generar acta con consecutivo, fecha, decisiones y anexos.
- [ ] Vincular decisiones a estudiantes, areas, planes de apoyo o promocion.
- [ ] Permitir aprobacion o firma del acta segun rol.
- [ ] Bloquear decisiones criticas sin acta o evidencia cuando el flujo lo exija.

### Cierre de periodo

- [ ] Checklist previo: notas completas, recuperaciones, asistencia, observaciones y boletines.
- [ ] Simulacion de cierre con inconsistencias.
- [ ] Bloqueo de notas al cerrar periodo.
- [ ] Reapertura controlada con motivo, responsable y fecha.
- [ ] Historial de cierres y reaperturas.
- [ ] Panel para coordinacion con avance por grado, grupo y asignatura.

### Cierre anual y promocion

- [ ] Decision final por estudiante: promovido, no promovido, promocion anticipada, graduado, retirado o pendiente.
- [ ] Motivo estructurado para no promocion o promocion condicionada.
- [ ] Vinculo con acta de comite.
- [ ] Validacion contra reglas del SIEE vigente.
- [ ] Preparacion de continuidad de matricula para el siguiente ano.
- [ ] Reporte de estudiantes con riesgo, pendientes o inconsistencias.

### Boletines

- [ ] Boletin por periodo con estado: borrador, revisado, publicado, entregado y rectificado.
- [ ] Boletin final anual.
- [ ] Consecutivo, fecha de emision, responsable y codigo de validacion.
- [ ] Rectificacion auditada con motivo y version anterior.
- [ ] Vista previa antes de publicar.
- [ ] Publicacion al portal de familia con historial de acceso o entrega.
- [ ] Plantillas por nivel o colegio sin mezclar logica academica con diseno.

### Asistencia

- [ ] Registro diario o por clase segun configuracion institucional.
- [ ] Estados controlados: presente, ausente, tarde, excusado y otros definidos por el colegio.
- [ ] Justificaciones con soporte documental.
- [ ] Acumulados por periodo, estudiante, grupo y asignatura.
- [ ] Alertas por inasistencia recurrente.
- [ ] Reporte para seguimiento de coordinacion y acudientes.
- [ ] Auditoria de cambios en asistencia.

### Convivencia escolar

- [ ] Modulo separado de observaciones academicas.
- [ ] Clasificacion de situaciones Tipo I, Tipo II y Tipo III.
- [ ] Registro de ruta de atencion: promocion, prevencion, atencion y seguimiento.
- [ ] Involucrados, acudientes, responsables, remisiones y medidas pedagogicas.
- [ ] Comite escolar de convivencia con actas, asistentes y decisiones.
- [ ] Seguimientos con fechas, compromisos y evidencias.
- [ ] Permisos estrictos por rol y confidencialidad.
- [ ] Evidencia de reporte externo cuando aplique, sin afirmar integracion automatica si no existe.

### Inclusion y PIAR

- [ ] Historia pedagogica restringida.
- [ ] Registro de barreras, apoyos, ajustes razonables y acuerdos con familia.
- [ ] PIAR por ano lectivo con responsables, fechas y seguimiento.
- [ ] Integracion de ajustes al proceso de evaluacion sin exponer diagnosticos innecesarios.
- [ ] Informe anual de competencias y transicion.
- [ ] Control de acceso a datos sensibles de salud, discapacidad y apoyos.
- [ ] Auditoria de lectura y cambios sobre informacion sensible.

### Reportes de apoyo Colombia

- [ ] Catalogos oficiales o compatibles: documento, sexo, departamento, municipio, grado, jornada, calendario, sector, zona y sede.
- [ ] Codigo DANE de institucion y sedes.
- [ ] Reporte de matricula y novedades para conciliacion con SIMAT.
- [ ] Reportes base para necesidades internas relacionadas con SINEB o DANE C-600.
- [ ] Evidencia de reporte: fecha, responsable, archivo, observaciones y estado.
- [ ] Texto visible en UI aclarando que OfirSchool apoya la preparacion y conciliacion, pero no reemplaza sistemas oficiales.

## Prioridades de implementacion

### Prioridad 1: ordenar la experiencia operativa

- [ ] Revisar navegacion de Operacion Academica y agrupar por tareas reales: asistencia, notas, cierres, boletines, convivencia e inclusion.
- [ ] Reemplazar pantallas densas por `ListView` o listados genericos con filtros, busqueda, estado y acciones.
- [ ] Agregar paneles de resumen por rol: docente, coordinador, secretaria y rectoria.
- [ ] Estandarizar estados visuales y acciones primarias.
- [ ] Reducir formularios largos usando secciones claras y validacion progresiva.

### Prioridad 2: cierre de periodo confiable

- [ ] Implementar checklist de cierre.
- [ ] Mostrar inconsistencias antes de bloquear.
- [ ] Bloquear notas y asistencia al cerrar.
- [ ] Permitir reapertura con auditoria.
- [ ] Preparar boletines desde datos cerrados.

### Prioridad 3: comites y actas

- [ ] Crear entidad de comite academico.
- [ ] Asociar actas a decisiones de promocion, planes de apoyo y casos revisados.
- [ ] Generar documento interno con consecutivo.
- [ ] Controlar aprobacion y cambios posteriores.

### Prioridad 4: convivencia formal

- [ ] Separar convivencia de observaciones generales.
- [ ] Implementar tipos de situacion y ruta de atencion.
- [ ] Agregar comite de convivencia y seguimiento.
- [ ] Restringir acceso por permisos finos.

### Prioridad 5: PIAR e inclusion

- [ ] Crear flujo PIAR con datos sensibles protegidos.
- [ ] Vincular ajustes a evaluacion y seguimiento docente.
- [ ] Generar informe de seguimiento y transicion.
- [ ] Registrar acuerdos con familia.

### Prioridad 6: reportes y documentos

- [ ] Completar boletines versionados.
- [ ] Crear actas de promocion y certificados academicos.
- [ ] Agregar validacion por codigo o QR a documentos emitidos.
- [ ] Registrar evidencias de reportes oficiales o de apoyo.

## Criterios de terminado

Una mejora de operacion academica se considera lista cuando:

- [ ] Tiene frontend usable por usuarios no tecnicos.
- [ ] Tiene backend y persistencia si el dato debe conservarse.
- [ ] Respeta sede, ano lectivo, rol y permisos.
- [ ] Registra auditoria en cambios sensibles.
- [ ] Tiene estados claros y transiciones controladas.
- [ ] Tiene pruebas o validacion manual documentada.
- [ ] No rompe `pnpm --filter @ofir/web typecheck`.
- [ ] No introduce errores nuevos en `pnpm --filter @ofir/api typecheck`.

## Fuentes normativas de referencia

- Decreto 1075 de 2015: Decreto Unico Reglamentario del Sector Educacion.
- Decreto 1290 de 2009: evaluacion del aprendizaje y promocion de estudiantes.
- Ley 1620 de 2013: Sistema Nacional de Convivencia Escolar.
- Decreto 1965 de 2013: reglamentacion de convivencia escolar.
- Decreto 1421 de 2017: educacion inclusiva y PIAR.
- Ley 1581 de 2012 y Decreto 1377 de 2013: proteccion de datos personales.
- Lineamientos vigentes del MEN y de la Secretaria de Educacion correspondiente.

## Riesgos abiertos

- [ ] Mezclar observaciones academicas, convivencia e inclusion puede exponer datos sensibles a roles no autorizados.
- [ ] Publicar boletines sin cierre formal puede generar inconsistencias.
- [ ] Cambiar notas sin motivo y auditoria debilita la trazabilidad institucional.
- [ ] PIAR y salud requieren permisos mas estrictos que una pantalla academica comun.
- [ ] Los reportes de apoyo no deben comunicarse como reemplazo de SIMAT, SIUCE, SINEB o DANE C-600.
