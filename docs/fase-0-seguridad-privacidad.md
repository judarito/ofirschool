# Fase 0: seguridad, privacidad y datos

Fecha: 2026-07-11

## Estrategia de sesion

Estado objetivo para pilotos:

- El `tenantId` operativo de rutas autenticadas sale del JWT validado.
- El frontend puede conservar `activeBranchId`, pero backend debe validar que el usuario pueda operar esa sede.
- El token de acceso expira en 12 horas.
- Ante expiracion o token invalido, el frontend limpia sesion local y redirige a login.
- El login tiene rate limiting por IP para reducir fuerza bruta.
- Las rutas protegidas no deben confiar en `x-tenant-id` enviado por el navegador.

Pendientes posteriores:

- Rotacion de tokens o refresh token con revocacion.
- Lista de sesiones activas por usuario.
- Cierre de sesion del lado servidor.
- Politica formal de duracion por rol.

## Matriz de datos personales y sensibles

| Categoria | Ejemplos | Sensibilidad | Acceso inicial recomendado | Retencion inicial |
| --- | --- | --- | --- | --- |
| Identificacion estudiante | nombres, documento, fecha nacimiento, grado | Personal | Administracion, secretaria, coordinacion autorizada | Historia academica institucional |
| Datos de acudiente | nombres, documento, telefono, email, parentesco | Personal | Administracion, secretaria | Mientras exista relacion academica y obligaciones documentales |
| Salud | RH, EPS, condiciones medicas, discapacidad | Sensible | Solo roles autorizados por necesidad operativa | Minima necesaria, con acceso auditado |
| Documentos cargados | registro civil, certificados, anexos | Personal/sensible segun documento | Secretaria y administracion autorizada | Segun politica documental del colegio |
| Convivencia | casos, involucrados, medidas, seguimientos | Sensible | Comite/convivencia y directivos autorizados | Segun manual y obligacion legal aplicable |
| PIAR/inclusion | barreras, ajustes, diagnosticos si existen | Sensible | Equipo autorizado y directivos pertinentes | Minima necesaria, con acceso auditado |
| Finanzas | responsable financiero, cobros, cartera, acuerdos | Personal/financiero | Administracion financiera autorizada | Segun obligacion contable/contractual |
| Auditoria | usuario, accion, IP, fecha, cambios | Seguridad | Administradores autorizados | Segun politica de seguridad |

## Retencion, archivo y eliminacion

- Cada colegio debe definir su tabla de retencion documental antes de cargar datos reales.
- Datos sensibles deben tener retencion minima y acceso auditado.
- Documentos de admision no convertida deben poder archivarse o eliminarse segun politica del colegio.
- Solicitudes de titulares deben registrarse con fecha, solicitante, tipo de solicitud, respuesta y evidencia.
- La eliminacion debe ser logica cuando exista obligacion de trazabilidad, y fisica solo cuando juridicamente proceda.

## Politica de almacenamiento de documentos de admision

- Ruta de objeto: `tenantSlug/academicYear/formSubmissionId/documentCode-randomId-fileName`.
- Almacenamiento: bucket privado `ADMISSIONS_BUCKET`; no se exponen URLs publicas ni rutas directas al navegador.
- Acceso: toda descarga pasa por `/api/admissions/documents/:id/download`, exige sesion, permiso `admissions.documents.download` y validacion de sede.
- Auditoria: cada descarga registra usuario, IP, documento, solicitud, entrega de formulario, sede, MIME y tamano.
- Integridad: cada archivo cargado guarda checksum SHA-256 en metadata de R2 y en `uploaded_documents.metadata`.
- Retencion inicial: conservar documentos de solicitudes convertidas mientras exista la relacion academica y la obligacion documental del colegio; solicitudes no convertidas se conservan solo durante la ventana definida por el colegio para reclamaciones y auditoria.
- Borrado: el borrado operativo debe marcar `uploaded_documents.is_deleted`; el borrado fisico en R2 solo procede cuando la politica documental y una solicitud autorizada lo permitan.
- Restauracion: antes de despliegues que cambien admisiones, confirmar backup o versionado del bucket segun el checklist de release.

## Protocolo de incidentes de seguridad

1. Registrar incidente: fecha/hora, reporter, sistema afectado, descripcion y severidad preliminar.
2. Contener: suspender credenciales, bloquear rutas, revocar accesos o aislar datos afectados.
3. Evaluar alcance: tenants, sedes, titulares, tipos de datos y volumen.
4. Clasificar datos: personales, sensibles, menores de edad, documentos, convivencia, salud o finanzas.
5. Preservar evidencia: logs, request id, usuario, IP, cambios, archivos afectados.
6. Notificar internamente al responsable del colegio y al responsable de tratamiento definido.
7. Evaluar si aplica reporte ante SIC dentro del plazo legal correspondiente.
8. Comunicar a titulares cuando sea requerido o prudente.
9. Corregir causa raiz y documentar acciones preventivas.
10. Cerrar con acta interna del incidente.

## Politica de backups y restauracion

- Definir frecuencia de backup por ambiente.
- Separar backups de produccion y desarrollo.
- Proteger backups con cifrado y acceso restringido.
- Probar restauracion antes de usar datos reales.
- Documentar responsable, fecha de ultima prueba, resultado y tiempo de recuperacion.
- Mantener inventario de dependencias externas: base de datos, R2/documentos, correo y hosting.

## Bitacora de datos sensibles

Acciones que deben auditarse:

- descarga o visualizacion de documentos;
- acceso a datos de salud, discapacidad, PIAR o convivencia;
- cambios de acudientes o responsables financieros;
- aprobacion, rechazo o conversion de admisiones;
- creacion, cancelacion, retiro o traslado de matriculas;
- exportaciones masivas.

Campos minimos:

- tenant, sede si aplica, usuario, rol, entidad, id de entidad, accion, fecha, IP, request id y cambios relevantes.
