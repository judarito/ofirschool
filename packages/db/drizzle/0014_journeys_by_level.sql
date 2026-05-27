ALTER TABLE academic_year_journeys
  ADD COLUMN IF NOT EXISTS target_level_name VARCHAR(30),
  ADD COLUMN IF NOT EXISTS target_grade_id UUID REFERENCES grades(id);
