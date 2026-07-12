-- 0020_consents.sql
-- Adds versioned consent documents and individual consent records
-- to support Ley 1581 de 2012 evidence trail for admissions and enrollment.

CREATE TABLE IF NOT EXISTS consent_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  document_type VARCHAR(40) NOT NULL,
  version VARCHAR(40) NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from DATE,
  superseded_by UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_consent_documents_tenant_code_version
  ON consent_documents (tenant_id, code, version, is_deleted);

CREATE INDEX IF NOT EXISTS idx_consent_documents_tenant_active
  ON consent_documents (tenant_id, code, is_active, is_deleted);

CREATE TABLE IF NOT EXISTS consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  consent_document_id UUID NOT NULL REFERENCES consent_documents(id),
  student_id UUID REFERENCES students(id),
  guardian_id UUID REFERENCES guardians(id),
  admission_application_id UUID REFERENCES admission_applications(id),
  enrollment_id UUID REFERENCES enrollments(id),
  form_submission_id UUID REFERENCES form_submissions(id),
  accepted_by_name VARCHAR(160) NOT NULL,
  accepted_by_document VARCHAR(40),
  accepted_by_relationship VARCHAR(40),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel VARCHAR(30) NOT NULL,
  ip_address VARCHAR(60),
  user_agent TEXT,
  text_snapshot TEXT NOT NULL,
  version VARCHAR(40) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'accepted',
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  revocation_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_consents_tenant_document
  ON consents (tenant_id, consent_document_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_consents_tenant_student
  ON consents (tenant_id, student_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_consents_tenant_admission
  ON consents (tenant_id, admission_application_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_consents_tenant_enrollment
  ON consents (tenant_id, enrollment_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_consents_tenant_status
  ON consents (tenant_id, status, is_deleted);
