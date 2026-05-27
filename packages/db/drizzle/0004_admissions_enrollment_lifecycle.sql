CREATE TABLE IF NOT EXISTS admission_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  student_id uuid NOT NULL,
  academic_year_id uuid NOT NULL,
  requested_grade_id uuid NOT NULL,
  requested_group_id uuid,
  primary_guardian_id uuid,
  status varchar(30) NOT NULL DEFAULT 'draft',
  source varchar(30) NOT NULL DEFAULT 'new_student',
  application_date timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  accepted_at timestamptz,
  rejected_at timestamptz,
  converted_enrollment_id uuid,
  fixed_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  CONSTRAINT chk_admission_applications_status CHECK (status IN ('draft', 'submitted', 'reviewing', 'accepted', 'rejected', 'cancelled', 'converted')),
  CONSTRAINT chk_admission_applications_source CHECK (source IN ('new_student', 'transfer', 'reentry'))
);

CREATE INDEX IF NOT EXISTS idx_admission_applications_tenant_year_status
  ON admission_applications (tenant_id, academic_year_id, status, is_deleted);

CREATE INDEX IF NOT EXISTS idx_admission_applications_tenant_student
  ON admission_applications (tenant_id, student_id, is_deleted);

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS admission_application_id uuid,
  ADD COLUMN IF NOT EXISTS previous_enrollment_id uuid,
  ADD COLUMN IF NOT EXISTS enrollment_type varchar(30) NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS promotion_status varchar(30),
  ADD COLUMN IF NOT EXISTS promoted_from_grade_id uuid,
  ADD COLUMN IF NOT EXISTS fixed_data jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE enrollments
  DROP CONSTRAINT IF EXISTS chk_enrollments_enrollment_type,
  ADD CONSTRAINT chk_enrollments_enrollment_type CHECK (enrollment_type IN ('new', 'renewal', 'promotion', 'auto_promotion', 'transfer'));

ALTER TABLE enrollments
  DROP CONSTRAINT IF EXISTS chk_enrollments_promotion_status,
  ADD CONSTRAINT chk_enrollments_promotion_status CHECK (promotion_status IS NULL OR promotion_status IN ('pending', 'promoted', 'not_promoted', 'conditional'));

CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_origin
  ON enrollments (tenant_id, enrollment_type, admission_application_id);

DROP INDEX IF EXISTS uq_enrollments_tenant_student_year_active;

CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollments_tenant_student_year_active
  ON enrollments (tenant_id, student_id, academic_year_id)
  WHERE is_deleted = false;

ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS admission_application_id uuid;

CREATE INDEX IF NOT EXISTS idx_form_submissions_tenant_admission
  ON form_submissions (tenant_id, admission_application_id);
