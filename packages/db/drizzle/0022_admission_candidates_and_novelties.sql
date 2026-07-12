-- 0022_admission_candidates_and_novelties.sql
-- Adds the candidate (pre-student) profile, multiple guardians with
-- relationship/role catalog, and enrollment novelties tracking.

CREATE TABLE IF NOT EXISTS admission_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  admission_application_id UUID REFERENCES admission_applications(id),
  form_submission_id UUID REFERENCES form_submissions(id),
  first_name VARCHAR(80) NOT NULL,
  middle_name VARCHAR(80),
  last_name VARCHAR(80) NOT NULL,
  document_type VARCHAR(20) NOT NULL,
  document_number VARCHAR(30) NOT NULL,
  document_expedition_place VARCHAR(100),
  birth_date DATE,
  gender VARCHAR(20),
  blood_type VARCHAR(10),
  eps VARCHAR(100),
  sisben_level VARCHAR(20),
  address VARCHAR(200),
  city VARCHAR(100),
  department VARCHAR(100),
  origin_institution VARCHAR(200),
  origin_grade VARCHAR(80),
  consolidated_student_id UUID REFERENCES students(id),
  consolidated_at TIMESTAMPTZ,
  consolidated_by UUID,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_admission_candidates_tenant_document
  ON admission_candidates (tenant_id, document_type, document_number, is_deleted);

CREATE INDEX IF NOT EXISTS idx_admission_candidates_tenant_application
  ON admission_candidates (tenant_id, admission_application_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_admission_candidates_tenant_status
  ON admission_candidates (tenant_id, status, is_deleted);

ALTER TABLE student_guardians
  ADD COLUMN IF NOT EXISTS relationship_type VARCHAR(40) NOT NULL DEFAULT 'academic_guardian';

ALTER TABLE student_guardians
  ADD COLUMN IF NOT EXISTS is_legal_representative BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE student_guardians
  ADD COLUMN IF NOT EXISTS is_financial_responsible BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE student_guardians
  ADD COLUMN IF NOT EXISTS is_emergency_contact BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE student_guardians
  ADD COLUMN IF NOT EXISTS is_pickup_authorized BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE student_guardians
  ADD COLUMN IF NOT EXISTS relationship_label VARCHAR(80);

CREATE INDEX IF NOT EXISTS idx_student_guardians_relationship
  ON student_guardians (tenant_id, relationship_type, is_deleted);

CREATE TABLE IF NOT EXISTS enrollment_novelties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  enrollment_id UUID NOT NULL REFERENCES enrollments(id),
  student_id UUID NOT NULL REFERENCES students(id),
  academic_year_id UUID REFERENCES academic_years(id),
  novelty_type VARCHAR(30) NOT NULL,
  effective_date DATE NOT NULL,
  reason_code VARCHAR(60),
  reason_label VARCHAR(160),
  notes TEXT,
  from_grade_id UUID REFERENCES grades(id),
  from_group_id UUID REFERENCES groups(id),
  to_grade_id UUID REFERENCES grades(id),
  to_group_id UUID REFERENCES groups(id),
  destination_institution VARCHAR(200),
  document_reference VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_enrollment_novelties_tenant_student
  ON enrollment_novelties (tenant_id, student_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_enrollment_novelties_tenant_enrollment
  ON enrollment_novelties (tenant_id, enrollment_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_enrollment_novelties_tenant_type
  ON enrollment_novelties (tenant_id, novelty_type, effective_date, is_deleted);

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER;

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS journey VARCHAR(40);

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES school_branches(id);

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS document_status VARCHAR(30) NOT NULL DEFAULT 'pending';

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS financial_status VARCHAR(30) NOT NULL DEFAULT 'pending';

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS academic_status VARCHAR(30) NOT NULL DEFAULT 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollments_tenant_year_sequence
  ON enrollments (tenant_id, academic_year_id, sequence_number)
  WHERE sequence_number IS NOT NULL AND is_deleted = false;
