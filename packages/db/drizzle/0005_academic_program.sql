CREATE TABLE IF NOT EXISTS course_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  academic_year_id uuid NOT NULL,
  group_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  weekly_hours integer NOT NULL DEFAULT 4
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_course_subjects_group_subject
  ON course_subjects (tenant_id, academic_year_id, group_id, subject_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_course_subjects_year_group
  ON course_subjects (tenant_id, academic_year_id, group_id, is_deleted);

CREATE TABLE IF NOT EXISTS learning_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  academic_year_id uuid NOT NULL,
  academic_period_id uuid NOT NULL,
  group_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  code varchar(30) NOT NULL,
  title varchar(160) NOT NULL,
  description text NOT NULL,
  weight integer NOT NULL DEFAULT 100
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_achievements_code
  ON learning_achievements (tenant_id, academic_year_id, academic_period_id, group_id, subject_id, code);

CREATE INDEX IF NOT EXISTS idx_learning_achievements_lookup
  ON learning_achievements (tenant_id, academic_year_id, group_id, subject_id, academic_period_id, is_deleted);
