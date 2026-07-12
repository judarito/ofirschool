# Checklist de release y migraciones

Fecha: 2026-07-11

## Antes de migrar

- [ ] Confirmar rama y commit a desplegar.
- [ ] Revisar `git status` y separar cambios no relacionados.
- [ ] Revisar migraciones nuevas en `packages/db/drizzle`.
- [ ] Confirmar variables de entorno requeridas.
- [ ] Confirmar backup reciente de base de datos.
- [ ] Confirmar backup o versionado de documentos externos si aplica.

## Validacion local

- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] Pruebas automatizadas disponibles.
- [ ] Flujo login.
- [ ] Flujo admision publica.
- [ ] Flujo conversion admision a matricula.
- [ ] Flujo continuidad/cierre anual si el release toca matriculas.
- [ ] Descarga de documentos si el release toca admisiones.

## Migracion

- [ ] Ejecutar migracion en ambiente de staging o copia.
- [ ] Revisar logs de migracion.
- [ ] Validar conteos basicos antes/despues.
- [ ] Ejecutar migracion en produccion en ventana autorizada.
- [ ] Registrar fecha, responsable, version y resultado.

## Despues del despliegue

- [ ] Verificar healthcheck.
- [ ] Verificar login y permisos por rol.
- [ ] Verificar tenant y sede con usuarios de prueba.
- [ ] Verificar una consulta principal por modulo afectado.
- [ ] Revisar logs de errores.
- [ ] Documentar incidentes o rollback si aplica.

## Rollback

- [ ] Identificar ultimo backup util.
- [ ] Identificar version anterior desplegable.
- [ ] Documentar impacto de revertir esquema o codigo.
- [ ] Ejecutar rollback solo con responsable autorizado.

