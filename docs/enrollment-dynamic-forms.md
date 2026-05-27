# Inscripción y matrícula: modelo híbrido

## Resumen

OfirSchool usa un modelo híbrido para inscripción y matrícula:

- Datos fijos operativos en tablas normales: `students`, `guardians`, `admission_applications`, `enrollments`.
- Datos configurables por colegio en formularios versionados: `form_templates`, `form_template_versions`, `form_sections`, `form_fields`, `form_submissions`, `form_field_values`, `required_documents`, `uploaded_documents`.

Este diseño evita un EAV puro y mantiene consultables los datos críticos. Los campos dinámicos quedan en una capa flexible, pero con valores tipados e índices por `tenant_id`, `field_code` y tipo de valor.

## Ventajas

- Los procesos centrales siguen siendo simples: estudiante, acudiente y matrícula no dependen de metadata.
- La inscripción no duplica identidad: siempre apunta a `students`, y si se acepta se convierte en una `enrollment`.
- Cada colegio puede ajustar formularios por año académico sin alterar columnas core.
- Las respuestas históricas quedan vinculadas a una versión concreta y guardan snapshots de schema, sección y campo.
- Los reportes pueden usar columnas fijas para KPIs principales y `form_field_values` para campos personalizados.
- El diseño escala mejor que EAV puro porque separa `value_text`, `value_number`, `value_date`, `value_boolean`, `value_timestamp` y `value_json`.

## Riesgos

- Si demasiados campos dinámicos se vuelven críticos, algunos deberían promoverse a columnas fijas.
- Los formularios publicados no deben editarse directamente; la API debe bloquearlo si existen respuestas.
- Los reportes complejos por campos dinámicos requieren convenciones fuertes de `field_code`.
- `value_json` sirve para multiselect y estructuras complejas, pero no debe convertirse en el lugar por defecto para todo.

## Mejoras propuestas

- Mantener un catálogo interno de campos recomendados por Colombia: EPS, SISBEN, estrato, autorizaciones, vacunas.
- Marcar campos dinámicos con `is_searchable` e `is_reportable` para controlar índices y exportaciones.
- Usar `data_key` para mapear campos dinámicos a dimensiones analíticas estables.
- Publicar una versión inmutable y clonar para cambios anuales.
- Agregar vistas materializadas futuras para reportes pesados por año y tenant.

## Entidades

## Flujo escolar real

```text
students
  Persona permanente del estudiante.
  No pertenece a un solo año. Mantiene identidad y datos generales.

admission_applications
  Proceso de inscripción/admisión para un año lectivo.
  Apunta a student_id, academic_year_id y requested_grade_id.
  Si se acepta, se crea una matrícula y queda converted_enrollment_id.

enrollments
  Matrícula anual del estudiante.
  Es el registro académico del estudiante para un año lectivo.
  Apunta a student_id, academic_year_id, grade_id y group_id.
  Puede nacer de una inscripción aceptada o de renovación/promoción anual.

form_submissions
  Respuestas dinámicas versionadas.
  Puede asociarse a una inscripción con admission_application_id
  o a una matrícula con enrollment_id.
```

Regla central:

- `students` contiene datos generales y permanentes.
- `admission_applications` contiene el proceso de entrada.
- Las fechas de apertura y cierre pertenecen al formulario/proceso público de inscripción del año lectivo, no a cada inscripción individual.
- `enrollments` contiene el estado académico anual.
- Cada estudiante tendrá máximo una matrícula activa por año lectivo.
- La primera matrícula normalmente nace de una inscripción aceptada.
- Las siguientes matrículas nacen de renovación, promoción o promoción automática.
- Los datos dinámicos de inscripción y matrícula viven en formularios versionados.

## Flujo operativo implementado hoy

### Ingreso nuevo

1. El proceso público se configura por año lectivo.
2. El formulario publicado recibe respuestas y documentos.
3. La respuesta crea `admission_applications` con estado `submitted`.
4. El backoffice mueve la solicitud por estados:
   - `reviewing`
   - `accepted`
   - `rejected`
5. Solo una solicitud `accepted` puede crear una fila en `enrollments`.
6. Al convertir, `admission_applications.status` pasa a `converted` y se completa `converted_enrollment_id`.

### Continuidad de alumnos antiguos

1. La continuidad no usa link público.
2. El backoffice consulta estudiantes elegibles para el nuevo año.
3. Si existe matrícula previa, la nueva fila en `enrollments` referencia `previous_enrollment_id`.
4. Los tipos esperados son:
   - `renewal`
   - `promotion`
   - `auto_promotion`
   - `transfer`
5. El módulo de continuidad masiva trabaja sobre la cohorte del año inmediatamente anterior y expone una vista previa antes de crear matrículas.
6. La vista previa sugiere:
   - mismo grado para `renewal`
   - siguiente grado configurado para `promotion`
   - siguiente grado configurado para `auto_promotion`
7. La ejecución por lote devuelve creados y omitidos, sin obligar a que todo falle en bloque.

### Controles de integridad

- no se permite convertir una admisión sin aprobación previa
- no se permite crear dos matrículas del mismo estudiante para el mismo año
- una matrícula de continuidad debe apuntar a una matrícula anterior válida del mismo estudiante
- la inscripción manual también evita duplicar estudiante/año y ahora reutiliza acudientes por documento

```text
students
  id, tenant_id, first_name, middle_name, last_name, document_type,
  document_number, birth_date, gender, blood_type, status, audit fields

guardians
  id, tenant_id, first_name, last_name, document_type, document_number,
  phone, email, relationship, audit fields

enrollments
  id, tenant_id, student_id, academic_year_id, grade_id, group_id,
  admission_application_id, previous_enrollment_id, enrollment_type,
  enrollment_status, enrollment_date, promotion_status, fixed_data,
  audit fields

admission_applications
  id, tenant_id, student_id, academic_year_id, requested_grade_id,
  requested_group_id, primary_guardian_id, status, source,
  application_date, submitted_at, reviewed_at, accepted_at,
  converted_enrollment_id, fixed_data, audit fields

form_templates
  id, tenant_id, code, name, module, entity_type, academic_year_id,
  starts_on, ends_on, status, active_version_id, settings, audit fields

form_template_versions
  id, tenant_id, form_template_id, version_number, status, published_at,
  cloned_from_version_id, schema_snapshot, audit fields

form_sections
  id, tenant_id, form_template_version_id, code, title, sort_order,
  visibility_rules, audit fields

form_fields
  id, tenant_id, form_template_version_id, form_section_id, code, label,
  field_type, options, validation_rules, visibility_rules,
  is_required, is_searchable, is_reportable, audit fields

form_submissions
  id, tenant_id, form_template_id, form_template_version_id,
  admission_application_id, enrollment_id, student_id, status,
  progress_percent, submitted_at, schema_snapshot, metadata, audit fields

form_field_values
  id, tenant_id, form_submission_id, form_field_id, field_code, field_type,
  value_text, value_number, value_boolean, value_date, value_timestamp,
  value_json, searchable_value, validation_status, audit fields

required_documents
  id, tenant_id, form_template_version_id, code, name, is_required,
  accepted_mime_types, max_file_size_mb, validation_rules, audit fields

uploaded_documents
  id, tenant_id, required_document_id, form_submission_id, student_id,
  file_name, file_key, mime_type, file_size_bytes, status, audit fields
```

## Versionamiento

- `form_templates` representa el formulario lógico.
- En inscripciones, `form_templates.starts_on` y `form_templates.ends_on` controlan si el formulario público está activo.
- `form_template_versions` representa una versión editable o publicada.
- Solo versiones `draft` pueden editar secciones, campos y documentos.
- Cuando una versión publicada tiene respuestas, cualquier cambio crea una nueva versión.
- `form_submissions.schema_snapshot` conserva la estructura usada por la respuesta.
- `form_field_values.field_label_snapshot` y `section_title_snapshot` conservan labels históricos aunque el formulario cambie.

## Link publico multi-tenant

- El enlace publico no debe depender de JWT ni de `x-tenant-id`.
- La URL recomendada es `/inscripcion/:tenantSlug/:year`, por ejemplo `/inscripcion/colegio-demo/2026`.
- El frontend publico consulta `GET /api/public/tenants/:tenantSlug/inscriptions/:year`.
- La API resuelve `tenantSlug -> tenant_id`, valida que el colegio este activo y busca el proceso/formulario publicado del año lectivo.
- Si la fecha actual esta fuera de `form_templates.starts_on` y `form_templates.ends_on`, la API responde el proceso como `scheduled` o `closed` y no expone campos del formulario.
- Si el proceso esta abierto, la API devuelve solo metadatos publicos del colegio, año, proceso, version publicada, secciones, campos y documentos requeridos.
- Las respuestas publicas deben crear una `admission_application` asociada al `tenant_id` resuelto por slug, nunca al tenant por defecto.

## Performance

- Todas las tablas tienen `tenant_id` e índices compuestos por tenant.
- Las consultas operativas usan tablas fijas.
- Los campos dinámicos reportables usan índices por `(tenant_id, field_code, searchable_value)`, `(tenant_id, field_code, value_number)` y `(tenant_id, field_code, value_date)`.
- `value_json` tiene índice GIN para casos multiselect o respuestas compuestas.
- Los listados principales deben paginar por servidor y filtrar siempre por `tenant_id` e `is_deleted`.

## Reportes

Para reportes mixtos:

1. Usar `students` + `enrollments` para identidad, grado, grupo, año y estado académico anual.
2. Usar `admission_applications` para embudo de inscripción y conversión a matrícula.
3. Unir `form_submissions` por `admission_application_id`, `enrollment_id` o `student_id`.
4. Unir `form_field_values` solo para `field_code` necesarios.
5. Exportar columnas dinámicas mediante pivote controlado desde metadata reportable.

## Frontend

Componentes previstos:

- `FormBuilderView`: diseñador drag-and-drop.
- `FormSectionEditor`: editor de secciones.
- `FormFieldPalette`: paleta de campos soportados.
- `FormFieldEditor`: propiedades, validaciones y opciones.
- `DynamicFormRenderer`: renderizador desde metadata.
- `DocumentUploadList`: documentos requeridos y estado.
- `AutosaveIndicator`: estado de guardado.
- `FormProgressBar`: progreso por requeridos completos.
- `CollapsibleFormSection`: secciones colapsables.

## Endpoints REST previstos

```text
GET    /api/form-templates
POST   /api/form-templates
GET    /api/form-templates/:id/versions/:versionId
POST   /api/form-templates/:id/versions
POST   /api/form-template-versions/:versionId/publish
POST   /api/form-template-versions/:versionId/clone
PUT    /api/form-template-versions/:versionId/sections
PUT    /api/form-template-versions/:versionId/fields
POST   /api/form-submissions
PATCH  /api/form-submissions/:id/autosave
POST   /api/form-submissions/:id/submit
POST   /api/form-submissions/:id/documents
```

## Archivos implementados

- `packages/db/src/schema.ts`
- `packages/db/drizzle/0001_enrollment_dynamic_forms.sql`
- `packages/db/drizzle/0004_admissions_enrollment_lifecycle.sql`
- `packages/db/src/seed.ts`
- `packages/db/src/migrate.ts`
