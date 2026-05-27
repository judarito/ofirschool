ALTER TABLE grade_records
  ADD COLUMN IF NOT EXISTS grade_value VARCHAR(80);

ALTER TABLE grade_records
  ADD COLUMN IF NOT EXISTS grade_value_type VARCHAR(20) DEFAULT 'numeric' NOT NULL;

UPDATE grade_records
SET
  grade_value = COALESCE(grade_value, score::text),
  grade_value_type = COALESCE(grade_value_type, 'numeric')
WHERE grade_value IS NULL OR grade_value_type IS NULL;
