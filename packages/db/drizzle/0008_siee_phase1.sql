-- Migración SIEE Fase 1: Configuración académica base
-- Agrega: academic_areas, grading_scales, performance_ranges
-- Modifica: grades (level_name, order_number), subjects (academic_area_id)

-- 1. Áreas académicas
CREATE TABLE IF NOT EXISTS academic_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(30) NOT NULL,
  description TEXT,
  color VARCHAR(10) DEFAULT '#6366f1',
  order_number INT DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  is_deleted BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID,
  updated_by UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_areas_tenant_code
  ON academic_areas (tenant_id, code) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_academic_areas_tenant
  ON academic_areas (tenant_id, is_active, is_deleted);

-- 2. Escalas de calificación institucional
CREATE TABLE IF NOT EXISTS grading_scales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(80) NOT NULL,
  min_value DECIMAL(5,2) NOT NULL,
  max_value DECIMAL(5,2) NOT NULL,
  passing_value DECIMAL(5,2) NOT NULL,
  decimal_places SMALLINT DEFAULT 1 NOT NULL,
  scale_type VARCHAR(20) DEFAULT 'numeric' NOT NULL, -- numeric | qualitative | mixed
  is_active BOOLEAN DEFAULT true NOT NULL,
  is_deleted BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_grading_scales_tenant
  ON grading_scales (tenant_id, is_active, is_deleted);

-- 3. Rangos de desempeño (mapeo escala institucional → escala nacional)
CREATE TABLE IF NOT EXISTS performance_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  grading_scale_id UUID NOT NULL,
  national_level VARCHAR(20) NOT NULL, -- SUPERIOR | HIGH | BASIC | LOW
  institutional_label VARCHAR(60) NOT NULL,
  min_score DECIMAL(5,2) NOT NULL,
  max_score DECIMAL(5,2) NOT NULL,
  is_passing BOOLEAN DEFAULT true NOT NULL,
  color VARCHAR(10) DEFAULT '#6366f1',
  description TEXT,
  is_deleted BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_performance_ranges_scale
  ON performance_ranges (tenant_id, grading_scale_id, is_deleted);

-- 4. Enriquecer la tabla grades
ALTER TABLE grades ADD COLUMN IF NOT EXISTS level_name VARCHAR(30);
-- 'preschool' | 'primary' | 'secondary' | 'middle'
ALTER TABLE grades ADD COLUMN IF NOT EXISTS order_number INT DEFAULT 0;

-- 5. Agregar academic_area_id a subjects (nullable para migración gradual)
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS academic_area_id UUID;
