CREATE TABLE IF NOT EXISTS academic_year_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  branch_id UUID REFERENCES school_branches(id),
  name VARCHAR(80) NOT NULL,
  code VARCHAR(30) NOT NULL,
  starts_at VARCHAR(5) NOT NULL,
  ends_at VARCHAR(5) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_year_journeys_scope_code
  ON academic_year_journeys (tenant_id, academic_year_id, branch_id, code, is_deleted);

CREATE INDEX IF NOT EXISTS idx_academic_year_journeys_lookup
  ON academic_year_journeys (tenant_id, academic_year_id, is_active, is_deleted);

CREATE TABLE IF NOT EXISTS academic_year_journey_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  journey_id UUID NOT NULL REFERENCES academic_year_journeys(id),
  day_of_week VARCHAR(15) NOT NULL,
  slot_order INTEGER NOT NULL,
  starts_at VARCHAR(5) NOT NULL,
  ends_at VARCHAR(5) NOT NULL,
  slot_type VARCHAR(20) NOT NULL DEFAULT 'class',
  label VARCHAR(80)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_year_journey_slots_order
  ON academic_year_journey_slots (tenant_id, journey_id, day_of_week, slot_order, is_deleted);

CREATE INDEX IF NOT EXISTS idx_academic_year_journey_slots_lookup
  ON academic_year_journey_slots (tenant_id, journey_id, day_of_week, is_deleted);

CREATE TABLE IF NOT EXISTS group_journey_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  group_id UUID NOT NULL REFERENCES groups(id),
  journey_id UUID NOT NULL REFERENCES academic_year_journeys(id),
  priority INTEGER NOT NULL DEFAULT 0,
  is_preferred BOOLEAN NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_group_journey_options_group_journey
  ON group_journey_options (tenant_id, academic_year_id, group_id, journey_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_group_journey_options_lookup
  ON group_journey_options (tenant_id, academic_year_id, group_id, is_deleted);

CREATE TABLE IF NOT EXISTS group_timetable_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  group_id UUID NOT NULL REFERENCES groups(id),
  journey_id UUID NOT NULL REFERENCES academic_year_journeys(id),
  journey_slot_id UUID NOT NULL REFERENCES academic_year_journey_slots(id),
  course_subject_id UUID REFERENCES course_subjects(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  teacher_id UUID REFERENCES teachers(id),
  day_of_week VARCHAR(15) NOT NULL,
  slot_order INTEGER NOT NULL,
  entry_type VARCHAR(20) NOT NULL DEFAULT 'class',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  notes TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_group_timetable_entries_group_slot
  ON group_timetable_entries (tenant_id, academic_year_id, group_id, day_of_week, slot_order, is_deleted);

CREATE UNIQUE INDEX IF NOT EXISTS uq_group_timetable_entries_teacher_slot
  ON group_timetable_entries (tenant_id, academic_year_id, teacher_id, day_of_week, slot_order, is_deleted);

CREATE INDEX IF NOT EXISTS idx_group_timetable_entries_group
  ON group_timetable_entries (tenant_id, academic_year_id, group_id, status, is_deleted);
