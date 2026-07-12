-- 0019_branches_fk.sql
-- Adds FK constraints on branch_id columns that were nullable before,
-- and adds branch_id to admission_applications and form_templates.

-- FK: users.branch_id → school_branches.id
ALTER TABLE users
  ADD CONSTRAINT fk_users_branch
  FOREIGN KEY (branch_id) REFERENCES school_branches(id);

-- FK: students.branch_id → school_branches.id
ALTER TABLE students
  ADD CONSTRAINT fk_students_branch
  FOREIGN KEY (branch_id) REFERENCES school_branches(id);

-- FK: groups.branch_id → school_branches.id
ALTER TABLE groups
  ADD CONSTRAINT fk_groups_branch
  FOREIGN KEY (branch_id) REFERENCES school_branches(id);

-- Add branch_id to admission_applications (nullable, per-branch inscriptions)
ALTER TABLE admission_applications
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES school_branches(id);

CREATE INDEX IF NOT EXISTS idx_admission_applications_branch
  ON admission_applications (tenant_id, branch_id, is_deleted)
  WHERE is_deleted = false;

-- Add branch_id to form_templates (nullable, per-branch forms)
ALTER TABLE form_templates
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES school_branches(id);

CREATE INDEX IF NOT EXISTS idx_form_templates_branch
  ON form_templates (tenant_id, branch_id, status, is_deleted)
  WHERE is_deleted = false;
