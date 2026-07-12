# Plan de producto y cumplimiento Colombia

Fecha: 2026-07-11

## Objetivo

Convertir OfirSchool en una plataforma escolar viable para colegios en Colombia, con foco inicial en instituciones privadas de preescolar, básica y media, sin prometer reemplazo de sistemas oficiales como SIMAT, SINEB, DANE C-600 o SIUCE.

Este documento es un checklist vivo. Marcar cada punto cuando exista implementación, evidencia funcional y validación mínima.

## Principios de producto

- [x] Priorizar trazabilidad sobre pantallas aisladas: quién hizo qué, cuándo, bajo qué regla, con qué consentimiento y con qué evidencia.
- [x] Separar claramente operación interna del colegio y reporte oficial ante entidades externas.
- [x] Diseñar para colegios privados primero; documentar explícitamente qué cambia para colegios oficiales.
- [x] No usar datos reales de estudiantes hasta cerrar aislamiento multitenant, seguridad básica, consentimiento y auditoría.
- [x] Mantener historial inmutable de decisiones académicas, convivenciales, financieras y documentales.

## Fase 0: base segura antes de pilotos reales

### Seguridad, privacidad y datos

- [x] Corregir aislamiento multitenant: el `tenantId` efectivo debe salir del token/sesión confiable y no de headers controlados por el navegador.
- [x] Validar sede activa contra permisos reales del usuario en todos los endpoints.
- [x] Reemplazar CORS abierto por orígenes permitidos por ambiente.
- [x] Agregar rate limiting y protección de fuerza bruta en login.
- [x] Definir estrategia de sesión: expiración, rotación, revocación y manejo seguro del token.
- [x] Crear matriz de datos personales y sensibles: estudiante, acudiente, salud, discapacidad, convivencia, finanzas y documentos.
- [x] Implementar bitácora de acceso a datos sensibles.
- [x] Definir retención, archivo, eliminación y exportación de datos por tipo documental.
- [x] Documentar protocolo de incidentes de seguridad, incluyendo evaluación de reporte ante SIC cuando aplique.
- [x] Crear política de backups y prueba de restauración.

### Calidad técnica

- [x] Corregir errores de `pnpm build`.
- [x] Crear comando real de lint, separado de typecheck.
- [x] Agregar pruebas mínimas para auth, tenant, matrícula, cierre académico y generación de boletines.
- [x] Configurar CI con typecheck, build y pruebas.
- [ ] Reducir archivos críticos demasiado grandes, empezando por `academic.ts` y vistas de más de 1000 líneas.
- [x] Crear checklist de release y migraciones.

### Gobierno legal y contractual

- [x] Crear aviso de privacidad versionado para familias, estudiantes y colaboradores.
- [x] Crear autorización de tratamiento de datos para acudientes/representantes.
- [x] Registrar evidencia de aceptación: versión, fecha, actor, canal, IP si aplica y texto aceptado.
- [x] Permitir revocación o gestión de solicitudes de derechos de titulares.
- [x] Crear inventario de encargados/subencargados de tratamiento: hosting, correo, analítica, PDF, IA u otros.
- [ ] Preparar contrato o anexo de tratamiento de datos para colegios clientes.

## Fase 1: núcleo vendible para colegio privado

### Admisión e inscripción

- [x] Formularios públicos versionados por año lectivo, grado y sede.
- [x] Campos colombianos sugeridos: tipo y número de documento, lugar de expedición, EPS, SISBEN, RH, dirección, acudientes y autorizaciones.
- [x] Documentos requeridos configurables por grado y tipo de aspirante.
- [x] Bandeja administrativa con estados, responsables, comentarios internos y causales.
- [x] Conversión de admisión a matrícula con confirmación de año, grado, grupo, jornada, sede y fecha.
- [x] Evidencia de consentimiento capturada durante inscripción pública.

### Matrícula

- [x] Historial único del estudiante con estados: admitido, matriculado, retirado, transferido, graduado y egresado.
- [x] Validación de cupos por grupo, sede y jornada.
- [x] Continuidad anual con simulación, conflictos, cupos y decisión académica previa.
- [x] Contrato de matrícula y pagaré/anexos configurables para colegios privados.
- [x] Responsable financiero separado del acudiente académico.
- [x] Soporte para novedades: retiro, traslado, reingreso, cambio de grupo, cambio de sede y graduación.

### Operación académica y SIEE

- [x] SIEE versionado por año lectivo con fecha de aprobación y vigencia.
- [x] Escalas por nivel o grado, incluyendo preescolar cualitativo.
- [x] Reglas configurables de ponderación, recuperación, habilitación y promoción.
- [x] Comités de evaluación y promoción con actas.
- [x] Cierre de periodo con bloqueo, reapertura controlada y auditoría.
- [x] Cierre anual con decisión de promoción, no promoción, promoción anticipada o graduación.
- [x] Historial de cambios de notas con motivo, actor y fecha.
- [x] Planes de apoyo y seguimiento por periodo.
- [x] Boletines por periodo y final anual con consecutivo, fecha de emisión y validación.

### Portales

- [x] Portal docente para notas, asistencia, observaciones, planes de apoyo y boletines.
- [x] Portal familia para inscripción, documentos, boletines, datos básicos, pagos y comunicaciones.
- [x] Portal estudiante, al menos para boletines, horarios y actividades cuando aplique.
- [x] Permisos por rol y por tipo de dato, no solo por pantalla.

## Fase 2: cumplimiento diferencial Colombia

### Reportes oficiales y datos MEN

- [x] Mantener catálogos oficiales necesarios: DANE, municipio, departamento, documento, sexo, jornada, grado, calendario, sector y zona.
- [x] Registrar código DANE de institución y sedes.
- [x] Preparar datos de matrícula para conciliación con SIMAT.
- [x] Exportar o generar reportes de apoyo para SIMAT, dejando claro que no reemplaza el sistema oficial.
- [x] Preparar información base para SINEB/DANE C-600 según aplique.
- [x] Registrar evidencia de reportes realizados: fecha, responsable, archivo, observaciones y estado.
- [x] Evitar cualquier bloqueo o retención indebida de estudiantes en reportes oficiales por razones de cartera.

### Convivencia escolar

- [x] Crear módulo de convivencia separado de "observaciones académicas".
- [x] Soportar clasificación de situaciones Tipo I, II y III.
- [x] Registrar ruta de atención: promoción, prevención, atención y seguimiento.
- [ ] Gestionar comité escolar de convivencia, actas, asistentes y decisiones.
- [x] Manejar involucrados, acudientes, remisiones, medidas pedagógicas y seguimiento.
- [x] Aplicar confidencialidad estricta y permisos granulares.
- [ ] Registrar evidencia de reporte a SIUCE cuando aplique.
- [x] Diseñar el módulo con enfoque de debido proceso, proporcionalidad y no revictimización.

### Inclusión y PIAR

- [ ] Crear historia pedagógica restringida para estudiantes con ajustes razonables.
- [ ] Registrar barreras, apoyos, ajustes, responsables y acuerdos con familia.
- [ ] Gestionar PIAR por año lectivo con seguimiento periódico.
- [ ] Integrar ajustes al proceso de evaluación sin exponer diagnósticos de forma innecesaria.
- [ ] Generar informe anual de competencias y transición entre grados o sedes.
- [ ] Controlar acceso a datos de salud, discapacidad y apoyos.

### Finanzas privadas

- [ ] Configurar régimen tarifario, resolución o acto de autorización, año lectivo y vigencia.
- [ ] Registrar matrícula, pensión, cobros periódicos y otros cobros autorizados.
- [ ] Validar que la matrícula no exceda el porcentaje permitido sobre la tarifa anual cuando aplique.
- [ ] Facturación o integración contable según estrategia del producto.
- [ ] Recaudo, conciliación, cartera, acuerdos de pago, descuentos, becas y notas crédito.
- [ ] Paz y salvo financiero sin afectar indebidamente matrícula o reportes oficiales.
- [ ] Historial auditable de cambios tarifarios.

## Fase 3: documentos, evidencias y automatización

### Documentos oficiales internos

- [ ] Certificado de estudio.
- [ ] Constancia de matrícula.
- [ ] Certificado de notas.
- [ ] Boletín por periodo.
- [ ] Boletín final anual.
- [ ] Acta de promoción.
- [ ] Libro final de calificaciones.
- [ ] Observador o historial convivencial con acceso restringido.
- [ ] Actas de comités académicos y convivenciales.
- [ ] Documentos con consecutivo, firma, fecha, emisor y QR o código de validación.

### Auditoría y evidencia

- [x] Bitácora por entidad crítica: estudiante, matrícula, nota, boletín, caso de convivencia, PIAR, consentimiento y cobro.
- [x] Comparación de versiones antes/después para cambios sensibles.
- [x] Exportación de evidencias para auditoría interna del colegio.
- [x] Alertas de vencimientos: documentos, consentimientos, seguimientos, comités, reportes y cierres.

### Automatización prudente

- [x] Plantillas de comunicación para familias con historial de envío.
- [x] Notificaciones por eventos importantes: admisión, matrícula, boletín, convivencia, cartera y documentos.
- [x] Asistentes de validación de datos antes de reportes oficiales.
- [x] Reglas configurables por colegio sin hardcodear políticas institucionales.

## Riesgos críticos abiertos

- [x] La app no debe manejar datos reales hasta corregir aislamiento multitenant y controles de privacidad.
- [x] Falta módulo real de convivencia escolar.
- [x] Falta PIAR e inclusión.
- [x] Falta gobierno de consentimiento y tratamiento de datos.
- [x] Falta soporte financiero privado robusto.
- [x] Falta estrategia clara de reportes oficiales.
- [x] El build actual debe quedar estable antes de aumentar superficie funcional.

## Criterios de avance

Una tarea solo debe marcarse como terminada cuando cumpla:

- [ ] Existe implementación funcional en frontend y backend si aplica.
- [ ] Existe persistencia o evidencia auditable cuando el proceso lo requiere.
- [ ] Está protegida por permisos adecuados.
- [ ] Se probó con datos demo representativos de colegios colombianos.
- [ ] No rompe `pnpm build`.
- [ ] Hay nota funcional o técnica en `docs/contexto-funcional.md` si cambia el comportamiento central.

## Métricas de madurez sugeridas

- [x] Seguridad y privacidad: 80% antes de pilotos con datos reales.
- [x] Admisión y matrícula: 85% antes de venta a primer colegio.
- [x] Operación académica y SIEE: 85% antes de cierre de periodo real.
- [x] Convivencia escolar: 70% antes de usarlo como módulo institucional.
- [x] Inclusión y PIAR: 70% antes de registrar datos sensibles.
- [x] Finanzas: 75% antes de facturación o cartera real.
- [x] Reportes oficiales: 70% antes de prometer acompañamiento operativo.

## Fuentes normativas de referencia

- MEN: SIMAT, SINEB, matrícula y pensiones, DANE C-600.
- Decreto 1075 de 2015: sector educación y SIEE.
- Decreto 1290 de 2009: evaluación y promoción escolar, compilado en Decreto 1075.
- Ley 1620 de 2013: convivencia escolar.
- Decreto 1965 de 2013: reglamentación de convivencia escolar.
- Decreto 1421 de 2017: educación inclusiva y PIAR.
- Ley 1581 de 2012 y Decreto 1377 de 2013: protección de datos personales.
- Guías, circulares y lineamientos vigentes de la Secretaría de Educación correspondiente.
