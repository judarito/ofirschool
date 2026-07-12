-- 0023_communications_documents_promotion.sql
-- Communication templates, enrollment document acceptance, promotion evidence.

CREATE TABLE IF NOT EXISTS communication_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(160) NOT NULL,
  channel VARCHAR(30) NOT NULL DEFAULT 'email',
  subject VARCHAR(200),
  body TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_communication_templates_tenant_code
  ON communication_templates (tenant_id, code, is_deleted);

CREATE INDEX IF NOT EXISTS idx_communication_templates_tenant_active
  ON communication_templates (tenant_id, is_active, is_deleted);

ALTER TABLE notification_logs
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS entity VARCHAR(80),
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS admission_application_id UUID REFERENCES admission_applications(id),
  ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES enrollments(id),
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES communication_templates(id),
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_notification_logs_tenant
  ON notification_logs (tenant_id, created_at, is_deleted);

CREATE INDEX IF NOT EXISTS idx_notification_logs_admission
  ON notification_logs (tenant_id, admission_application_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_notification_logs_enrollment
  ON notification_logs (tenant_id, enrollment_id, is_deleted);

CREATE TABLE IF NOT EXISTS enrollment_document_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  enrollment_id UUID NOT NULL REFERENCES enrollments(id),
  student_id UUID NOT NULL REFERENCES students(id),
  document_code VARCHAR(60) NOT NULL,
  document_name VARCHAR(160) NOT NULL,
  document_version VARCHAR(40) NOT NULL,
  text_snapshot TEXT NOT NULL,
  accepted_by_name VARCHAR(160) NOT NULL,
  accepted_by_relationship VARCHAR(40),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel VARCHAR(30) NOT NULL DEFAULT 'admin_panel',
  ip_address VARCHAR(60),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollment_document_acceptance_enrollment_document
  ON enrollment_document_acceptance (tenant_id, enrollment_id, document_code, is_deleted);

CREATE INDEX IF NOT EXISTS idx_enrollment_document_acceptance_enrollment
  ON enrollment_document_acceptance (tenant_id, enrollment_id, is_deleted);

ALTER TABLE academic_years
  ADD COLUMN IF NOT EXISTS promotion_committee_act VARCHAR(200),
  ADD COLUMN IF NOT EXISTS promotion_committee_date DATE,
  ADD COLUMN IF NOT EXISTS promotion_committee_notes TEXT;

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promoted_by UUID,
  ADD COLUMN IF NOT EXISTS promotion_evidence_notes TEXT,
  ADD COLUMN IF NOT EXISTS conditional_promotion_requirements TEXT;
