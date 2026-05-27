CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS middle_name varchar(80),
  ADD COLUMN IF NOT EXISTS blood_type varchar(10);

ALTER TABLE guardians
  ADD COLUMN IF NOT EXISTS first_name varchar(80) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name varchar(80) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS document_type varchar(20) NOT NULL DEFAULT 'CC';

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS enrollment_status varchar(30) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS enrollment_date timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  code varchar(80) NOT NULL,
  name varchar(160) NOT NULL,
  description text,
  module varchar(60) NOT NULL DEFAULT 'enrollment',
  entity_type varchar(60) NOT NULL DEFAULT 'enrollment',
  academic_year_id uuid,
  status varchar(30) NOT NULL DEFAULT 'active',
  active_version_id uuid,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_form_templates_status CHECK (status IN ('active', 'inactive', 'archived'))
);

CREATE TABLE IF NOT EXISTS form_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  form_template_id uuid NOT NULL,
  version_number integer NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  published_by uuid,
  cloned_from_version_id uuid,
  schema_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  CONSTRAINT chk_form_template_versions_status CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE IF NOT EXISTS form_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  form_template_version_id uuid NOT NULL,
  code varchar(80) NOT NULL,
  title varchar(160) NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_collapsible boolean NOT NULL DEFAULT true,
  is_collapsed_by_default boolean NOT NULL DEFAULT false,
  visibility_rules jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  form_template_version_id uuid NOT NULL,
  form_section_id uuid NOT NULL,
  code varchar(80) NOT NULL,
  label varchar(160) NOT NULL,
  help_text text,
  field_type varchar(30) NOT NULL,
  data_key varchar(120),
  sort_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT false,
  is_searchable boolean NOT NULL DEFAULT false,
  is_reportable boolean NOT NULL DEFAULT false,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_value jsonb,
  placeholder varchar(160),
  CONSTRAINT chk_form_fields_field_type CHECK (
    field_type IN (
      'text',
      'textarea',
      'number',
      'decimal',
      'date',
      'datetime',
      'checkbox',
      'radio',
      'select',
      'multiselect',
      'email',
      'phone',
      'file',
      'document_number',
      'city',
      'department',
      'address'
    )
  )
);

CREATE TABLE IF NOT EXISTS form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  form_template_id uuid NOT NULL,
  form_template_version_id uuid NOT NULL,
  academic_year_id uuid,
  enrollment_id uuid,
  student_id uuid,
  submitted_by_guardian_id uuid,
  status varchar(30) NOT NULL DEFAULT 'draft',
  progress_percent integer NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  last_autosaved_at timestamptz,
  locked_at timestamptz,
  schema_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_form_submissions_status CHECK (status IN ('draft', 'submitted', 'reviewing', 'approved', 'rejected', 'cancelled')),
  CONSTRAINT chk_form_submissions_progress CHECK (progress_percent BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS form_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  form_submission_id uuid NOT NULL,
  form_field_id uuid NOT NULL,
  form_section_id uuid NOT NULL,
  field_code varchar(80) NOT NULL,
  field_type varchar(30) NOT NULL,
  field_label_snapshot varchar(160) NOT NULL,
  section_title_snapshot varchar(160) NOT NULL,
  value_text text,
  value_number numeric(14,4),
  value_boolean boolean,
  value_date date,
  value_timestamp timestamptz,
  value_json jsonb,
  searchable_value text,
  validation_status varchar(30) NOT NULL DEFAULT 'valid',
  CONSTRAINT chk_form_field_values_validation_status CHECK (validation_status IN ('valid', 'invalid', 'pending'))
);

CREATE TABLE IF NOT EXISTS required_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  form_template_version_id uuid NOT NULL,
  code varchar(80) NOT NULL,
  name varchar(160) NOT NULL,
  description text,
  is_required boolean NOT NULL DEFAULT true,
  accepted_mime_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_file_size_mb integer NOT NULL DEFAULT 10,
  sort_order integer NOT NULL DEFAULT 0,
  validation_rules jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS uploaded_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  required_document_id uuid NOT NULL,
  form_submission_id uuid NOT NULL,
  student_id uuid,
  file_name varchar(255) NOT NULL,
  file_key text NOT NULL,
  mime_type varchar(120) NOT NULL,
  file_size_bytes integer NOT NULL,
  checksum varchar(128),
  status varchar(30) NOT NULL DEFAULT 'uploaded',
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_uploaded_documents_status CHECK (status IN ('uploaded', 'approved', 'rejected', 'replaced'))
);

CREATE INDEX IF NOT EXISTS idx_students_tenant_document
  ON students (tenant_id, document_type, document_number);

CREATE INDEX IF NOT EXISTS idx_students_tenant_status
  ON students (tenant_id, status, is_deleted);

CREATE INDEX IF NOT EXISTS idx_guardians_tenant_document
  ON guardians (tenant_id, document_type, document_number);

CREATE INDEX IF NOT EXISTS idx_guardians_tenant_email
  ON guardians (tenant_id, email);

CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_year_status
  ON enrollments (tenant_id, academic_year_id, enrollment_status, is_deleted);

CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_student_year
  ON enrollments (tenant_id, student_id, academic_year_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_form_templates_tenant_code_year
  ON form_templates (tenant_id, code, academic_year_id);

CREATE INDEX IF NOT EXISTS idx_form_templates_tenant_module
  ON form_templates (tenant_id, module, status, is_deleted);

CREATE UNIQUE INDEX IF NOT EXISTS uq_form_template_versions_template_number
  ON form_template_versions (tenant_id, form_template_id, version_number);

CREATE INDEX IF NOT EXISTS idx_form_template_versions_status
  ON form_template_versions (tenant_id, form_template_id, status, is_deleted);

CREATE UNIQUE INDEX IF NOT EXISTS uq_form_sections_version_code
  ON form_sections (tenant_id, form_template_version_id, code);

CREATE INDEX IF NOT EXISTS idx_form_sections_version_order
  ON form_sections (tenant_id, form_template_version_id, sort_order, is_deleted);

CREATE UNIQUE INDEX IF NOT EXISTS uq_form_fields_version_code
  ON form_fields (tenant_id, form_template_version_id, code);

CREATE INDEX IF NOT EXISTS idx_form_fields_version_section_order
  ON form_fields (tenant_id, form_template_version_id, form_section_id, sort_order, is_deleted);

CREATE INDEX IF NOT EXISTS idx_form_fields_reportable
  ON form_fields (tenant_id, form_template_version_id, is_reportable, is_searchable);

CREATE INDEX IF NOT EXISTS idx_form_submissions_tenant_template_status
  ON form_submissions (tenant_id, form_template_id, status, is_deleted);

CREATE INDEX IF NOT EXISTS idx_form_submissions_tenant_student_year
  ON form_submissions (tenant_id, student_id, academic_year_id);

CREATE INDEX IF NOT EXISTS idx_form_submissions_tenant_enrollment
  ON form_submissions (tenant_id, enrollment_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_form_field_values_submission_field
  ON form_field_values (tenant_id, form_submission_id, form_field_id);

CREATE INDEX IF NOT EXISTS idx_form_field_values_code_text
  ON form_field_values (tenant_id, field_code, searchable_value);

CREATE INDEX IF NOT EXISTS idx_form_field_values_code_number
  ON form_field_values (tenant_id, field_code, value_number);

CREATE INDEX IF NOT EXISTS idx_form_field_values_code_date
  ON form_field_values (tenant_id, field_code, value_date);

CREATE INDEX IF NOT EXISTS idx_form_field_values_json_gin
  ON form_field_values USING gin (value_json);

CREATE UNIQUE INDEX IF NOT EXISTS uq_required_documents_version_code
  ON required_documents (tenant_id, form_template_version_id, code);

CREATE INDEX IF NOT EXISTS idx_required_documents_version_order
  ON required_documents (tenant_id, form_template_version_id, sort_order, is_deleted);

CREATE INDEX IF NOT EXISTS idx_uploaded_documents_submission
  ON uploaded_documents (tenant_id, form_submission_id, status, is_deleted);

CREATE INDEX IF NOT EXISTS idx_uploaded_documents_student
  ON uploaded_documents (tenant_id, student_id, status);
