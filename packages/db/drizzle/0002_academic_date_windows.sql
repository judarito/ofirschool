ALTER TABLE grades
  ADD COLUMN IF NOT EXISTS starts_on date,
  ADD COLUMN IF NOT EXISTS ends_on date;

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS starts_on date,
  ADD COLUMN IF NOT EXISTS ends_on date;

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS starts_on date,
  ADD COLUMN IF NOT EXISTS ends_on date;

ALTER TABLE form_templates
  ADD COLUMN IF NOT EXISTS starts_on date,
  ADD COLUMN IF NOT EXISTS ends_on date;

CREATE INDEX IF NOT EXISTS idx_grades_tenant_dates
  ON grades (tenant_id, starts_on, ends_on, is_deleted);

CREATE INDEX IF NOT EXISTS idx_groups_tenant_grade_dates
  ON groups (tenant_id, grade_id, starts_on, ends_on, is_deleted);

CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_dates
  ON enrollments (tenant_id, starts_on, ends_on, is_deleted);

CREATE INDEX IF NOT EXISTS idx_form_templates_tenant_dates
  ON form_templates (tenant_id, starts_on, ends_on, status, is_deleted);

ALTER TABLE grades
  DROP CONSTRAINT IF EXISTS chk_grades_date_window,
  ADD CONSTRAINT chk_grades_date_window CHECK (starts_on IS NULL OR ends_on IS NULL OR starts_on <= ends_on);

ALTER TABLE groups
  DROP CONSTRAINT IF EXISTS chk_groups_date_window,
  ADD CONSTRAINT chk_groups_date_window CHECK (starts_on IS NULL OR ends_on IS NULL OR starts_on <= ends_on);

ALTER TABLE enrollments
  DROP CONSTRAINT IF EXISTS chk_enrollments_date_window,
  ADD CONSTRAINT chk_enrollments_date_window CHECK (starts_on IS NULL OR ends_on IS NULL OR starts_on <= ends_on);

ALTER TABLE form_templates
  DROP CONSTRAINT IF EXISTS chk_form_templates_date_window,
  ADD CONSTRAINT chk_form_templates_date_window CHECK (starts_on IS NULL OR ends_on IS NULL OR starts_on <= ends_on);
