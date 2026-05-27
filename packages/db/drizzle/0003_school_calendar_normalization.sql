ALTER TABLE grades
  DROP CONSTRAINT IF EXISTS chk_grades_date_window;

DROP INDEX IF EXISTS idx_grades_tenant_dates;

ALTER TABLE grades
  DROP COLUMN IF EXISTS starts_on,
  DROP COLUMN IF EXISTS ends_on;

ALTER TABLE groups
  DROP CONSTRAINT IF EXISTS chk_groups_date_window;

DROP INDEX IF EXISTS idx_groups_tenant_grade_dates;

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS academic_year_id uuid,
  DROP COLUMN IF EXISTS starts_on,
  DROP COLUMN IF EXISTS ends_on;

UPDATE groups AS g
SET academic_year_id = y.id
FROM academic_years AS y
WHERE g.academic_year_id IS NULL
  AND y.tenant_id = g.tenant_id
  AND y.is_active = true
  AND y.is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_groups_tenant_year_grade
  ON groups (tenant_id, academic_year_id, grade_id, is_deleted);

ALTER TABLE enrollments
  DROP CONSTRAINT IF EXISTS chk_enrollments_date_window;

DROP INDEX IF EXISTS idx_enrollments_tenant_dates;

ALTER TABLE enrollments
  DROP COLUMN IF EXISTS starts_on,
  DROP COLUMN IF EXISTS ends_on;
