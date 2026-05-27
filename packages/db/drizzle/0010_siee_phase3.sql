-- Migración SIEE Fase 3: Evaluación y Calificaciones
-- Agrega: evaluation_activities, activity_scores, academic_observations, observation_bank, support_strategies
-- Modifica: grade_records, attendance_records, academic_periods

-- 1. Modificaciones a tablas existentes
ALTER TABLE academic_periods ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'open' NOT NULL;

ALTER TABLE grade_records ADD COLUMN IF NOT EXISTS group_id UUID;
ALTER TABLE grade_records ADD COLUMN IF NOT EXISTS academic_year_id UUID;

ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS academic_year_id UUID;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS academic_period_id UUID;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS justified BOOLEAN DEFAULT false NOT NULL;

-- 2. Actividades evaluativas
CREATE TABLE IF NOT EXISTS evaluation_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  academic_year_id UUID NOT NULL,
  academic_period_id UUID NOT NULL,
  group_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  achievement_id UUID NOT NULL,
  teacher_id UUID,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  activity_type VARCHAR(30) NOT NULL,
  weight_percentage DECIMAL(5,2) NOT NULL,
  max_score DECIMAL(5,2) DEFAULT 5.00 NOT NULL,
  due_date DATE,
  is_published BOOLEAN DEFAULT false NOT NULL,
  is_deleted BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_evaluation_activities_lookup 
  ON evaluation_activities (tenant_id, academic_year_id, academic_period_id, group_id, subject_id, is_deleted);

-- 3. Calificaciones por actividad
CREATE TABLE IF NOT EXISTS activity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  activity_id UUID NOT NULL,
  student_id UUID NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  performance_level VARCHAR(20),
  observations TEXT,
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  graded_by UUID,
  is_deleted BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID,
  updated_by UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_scores_student 
  ON activity_scores (tenant_id, activity_id, student_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_activity_scores_student 
  ON activity_scores (tenant_id, student_id);

-- 4. Observaciones académicas
CREATE TABLE IF NOT EXISTS academic_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  academic_year_id UUID NOT NULL,
  academic_period_id UUID NOT NULL,
  student_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  achievement_id UUID,
  observation_type VARCHAR(30) NOT NULL,
  text TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_academic_observations_lookup 
  ON academic_observations (tenant_id, academic_year_id, academic_period_id, student_id, subject_id, is_deleted);

-- 5. Banco de observaciones
CREATE TABLE IF NOT EXISTS observation_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  subject_id UUID,
  grade_id UUID,
  performance_level VARCHAR(20),
  observation_type VARCHAR(30) NOT NULL,
  text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  is_deleted BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_observation_bank_lookup 
  ON observation_bank (tenant_id, is_deleted);

-- 6. Estrategias de apoyo (recuperación)
CREATE TABLE IF NOT EXISTS support_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  academic_year_id UUID NOT NULL,
  academic_period_id UUID NOT NULL,
  student_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  achievement_id UUID,
  teacher_id UUID,
  description TEXT NOT NULL,
  due_date DATE,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  result_score DECIMAL(5,2),
  is_deleted BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_support_strategies_lookup 
  ON support_strategies (tenant_id, academic_year_id, academic_period_id, student_id, subject_id, is_deleted);

-- 7. Agregar llaves foráneas
ALTER TABLE evaluation_activities 
  ADD CONSTRAINT evaluation_activities_achievement_id_fk FOREIGN KEY (achievement_id) REFERENCES learning_achievements (id);
ALTER TABLE evaluation_activities 
  ADD CONSTRAINT evaluation_activities_teacher_id_fk FOREIGN KEY (teacher_id) REFERENCES teachers (id);

ALTER TABLE activity_scores 
  ADD CONSTRAINT activity_scores_activity_id_fk FOREIGN KEY (activity_id) REFERENCES evaluation_activities (id);
ALTER TABLE activity_scores 
  ADD CONSTRAINT activity_scores_student_id_fk FOREIGN KEY (student_id) REFERENCES students (id);

ALTER TABLE academic_observations 
  ADD CONSTRAINT academic_observations_student_id_fk FOREIGN KEY (student_id) REFERENCES students (id);
ALTER TABLE academic_observations 
  ADD CONSTRAINT academic_observations_subject_id_fk FOREIGN KEY (subject_id) REFERENCES subjects (id);
ALTER TABLE academic_observations 
  ADD CONSTRAINT academic_observations_achievement_id_fk FOREIGN KEY (achievement_id) REFERENCES learning_achievements (id);

ALTER TABLE observation_bank 
  ADD CONSTRAINT observation_bank_subject_id_fk FOREIGN KEY (subject_id) REFERENCES subjects (id);
ALTER TABLE observation_bank 
  ADD CONSTRAINT observation_bank_grade_id_fk FOREIGN KEY (grade_id) REFERENCES grades (id);

ALTER TABLE support_strategies 
  ADD CONSTRAINT support_strategies_student_id_fk FOREIGN KEY (student_id) REFERENCES students (id);
ALTER TABLE support_strategies 
  ADD CONSTRAINT support_strategies_subject_id_fk FOREIGN KEY (subject_id) REFERENCES subjects (id);
ALTER TABLE support_strategies 
  ADD CONSTRAINT support_strategies_achievement_id_fk FOREIGN KEY (achievement_id) REFERENCES learning_achievements (id);
ALTER TABLE support_strategies 
  ADD CONSTRAINT support_strategies_teacher_id_fk FOREIGN KEY (teacher_id) REFERENCES teachers (id);
