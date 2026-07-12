-- 0021_admission_status_and_document_review.sql
-- Adds structured workflow to admissions: status history, document reviews,
-- and decision causals aligned with the plan-admision-matricula checklist.

CREATE TABLE IF NOT EXISTS admission_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  admission_application_id UUID NOT NULL REFERENCES admission_applications(id),
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  actor_user_id UUID,
  actor_role VARCHAR(40),
  decision_code VARCHAR(60),
  decision_label VARCHAR(160),
  is_internal BOOLEAN NOT NULL DEFAULT true,
  is_visible_to_family BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_admission_status_history_application
  ON admission_status_history (tenant_id, admission_application_id, created_at);

CREATE INDEX IF NOT EXISTS idx_admission_status_history_status
  ON admission_status_history (tenant_id, to_status, is_deleted);

CREATE TABLE IF NOT EXISTS admission_decision_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  code VARCHAR(60) NOT NULL,
  outcome VARCHAR(30) NOT NULL,
  label VARCHAR(160) NOT NULL,
  description TEXT,
  requires_observation BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_decision_reasons_tenant_code
  ON admission_decision_reasons (tenant_id, code, is_deleted);

CREATE INDEX IF NOT EXISTS idx_admission_decision_reasons_outcome
  ON admission_decision_reasons (tenant_id, outcome, is_active, is_deleted);

CREATE TABLE IF NOT EXISTS admission_document_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  admission_application_id UUID NOT NULL REFERENCES admission_applications(id),
  uploaded_document_id UUID NOT NULL REFERENCES uploaded_documents(id),
  status VARCHAR(30) NOT NULL,
  reason_code VARCHAR(60),
  reason_label VARCHAR(160),
  notes TEXT,
  requested_correction TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_document_reviews_document
  ON admission_document_reviews (tenant_id, uploaded_document_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_admission_document_reviews_application
  ON admission_document_reviews (tenant_id, admission_application_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_admission_document_reviews_status
  ON admission_document_reviews (tenant_id, status, is_deleted);

ALTER TABLE uploaded_documents
  ADD COLUMN IF NOT EXISTS review_status VARCHAR(30) NOT NULL DEFAULT 'pending';
