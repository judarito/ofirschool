CREATE TABLE IF NOT EXISTS academic_year_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  journey_id UUID REFERENCES academic_year_journeys(id),
  level_code VARCHAR(30) NOT NULL,
  name VARCHAR(80) NOT NULL,
  order_number INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_year_levels_scope
  ON academic_year_levels (tenant_id, academic_year_id, journey_id, level_code, is_deleted);

CREATE INDEX IF NOT EXISTS idx_academic_year_levels_lookup
  ON academic_year_levels (tenant_id, academic_year_id, is_active, is_deleted);
