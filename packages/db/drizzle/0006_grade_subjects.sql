CREATE TABLE IF NOT EXISTS grade_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  academic_year_id uuid NOT NULL,
  grade_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  weekly_hours integer NOT NULL DEFAULT 4
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_grade_subjects_grade_subject
  ON grade_subjects (tenant_id, academic_year_id, grade_id, subject_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_grade_subjects_year_grade
  ON grade_subjects (tenant_id, academic_year_id, grade_id, is_deleted);
