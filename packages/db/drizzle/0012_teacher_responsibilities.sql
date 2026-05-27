CREATE TABLE IF NOT EXISTS teacher_responsibilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  responsibility_type VARCHAR(40) NOT NULL,
  group_id UUID REFERENCES groups(id),
  title VARCHAR(120),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_teacher_responsibilities_lookup
  ON teacher_responsibilities (tenant_id, academic_year_id, responsibility_type, is_deleted);

CREATE INDEX IF NOT EXISTS idx_teacher_responsibilities_teacher
  ON teacher_responsibilities (tenant_id, teacher_id, is_deleted);
