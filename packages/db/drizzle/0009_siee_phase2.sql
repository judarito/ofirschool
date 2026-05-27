-- Migración SIEE Fase 2: Competencias y evidencias (indicadores)
-- Agrega: competencies, achievement_indicators
-- Modifica: learning_achievements (competency_id, order_number, expected_performance)

-- 1. Competencias
CREATE TABLE IF NOT EXISTS competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  academic_area_id UUID NOT NULL,
  subject_id UUID,
  grade_id UUID,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  order_number INT DEFAULT 0 NOT NULL,
  is_deleted BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_competencies_area
  ON competencies (tenant_id, academic_area_id, is_deleted);

-- 2. Modificar learning_achievements para asociarlo a competencias
ALTER TABLE learning_achievements ADD COLUMN IF NOT EXISTS competency_id UUID;
ALTER TABLE learning_achievements ADD COLUMN IF NOT EXISTS order_number INT DEFAULT 0 NOT NULL;
ALTER TABLE learning_achievements ADD COLUMN IF NOT EXISTS expected_performance VARCHAR(20);

-- 3. Indicadores de logro (Evidencias de aprendizaje)
CREATE TABLE IF NOT EXISTS achievement_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  achievement_id UUID NOT NULL,
  description TEXT NOT NULL,
  order_number INT DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  is_deleted BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_achievement_indicators_achievement
  ON achievement_indicators (tenant_id, achievement_id, is_deleted);

-- 4. Agregar llaves foráneas
ALTER TABLE competencies 
  ADD CONSTRAINT competencies_academic_area_id_fk FOREIGN KEY (academic_area_id) REFERENCES academic_areas (id);
ALTER TABLE competencies 
  ADD CONSTRAINT competencies_subject_id_fk FOREIGN KEY (subject_id) REFERENCES subjects (id);
ALTER TABLE competencies 
  ADD CONSTRAINT competencies_grade_id_fk FOREIGN KEY (grade_id) REFERENCES grades (id);

ALTER TABLE learning_achievements 
  ADD CONSTRAINT learning_achievements_competency_id_fk FOREIGN KEY (competency_id) REFERENCES competencies (id);

ALTER TABLE achievement_indicators 
  ADD CONSTRAINT achievement_indicators_achievement_id_fk FOREIGN KEY (achievement_id) REFERENCES learning_achievements (id);
