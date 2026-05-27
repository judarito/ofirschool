-- Migración: cambiar learning_achievements de group_id a grade_id
-- Un logro se define a nivel de grado, no de curso específico.

-- 1. Agregar columna grade_id (nullable primero para poder poblarla)
ALTER TABLE learning_achievements ADD COLUMN IF NOT EXISTS grade_id uuid;

-- 2. Poblar grade_id desde la tabla groups para registros existentes
UPDATE learning_achievements la
SET grade_id = g.grade_id
FROM groups g
WHERE g.id = la.group_id
  AND la.grade_id IS NULL;

-- 3. Hacer grade_id NOT NULL
ALTER TABLE learning_achievements ALTER COLUMN grade_id SET NOT NULL;

-- 4. Eliminar columna group_id
ALTER TABLE learning_achievements DROP COLUMN IF EXISTS group_id;

-- 5. Recrear índice único (ahora con grade_id)
DROP INDEX IF EXISTS uq_learning_achievements_code;
CREATE UNIQUE INDEX uq_learning_achievements_code
  ON learning_achievements (tenant_id, academic_year_id, academic_period_id, grade_id, subject_id, code)
  WHERE is_deleted = false;

-- 6. Recrear índice de búsqueda (ahora con grade_id)
DROP INDEX IF EXISTS idx_learning_achievements_lookup;
CREATE INDEX idx_learning_achievements_lookup
  ON learning_achievements (tenant_id, academic_year_id, grade_id, subject_id, academic_period_id, is_deleted);
