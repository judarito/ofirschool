-- 0024_colombia_catalogs_reports_sensitive_data.sql
-- DANE codes, official report tracking, document type catalog, sensitive data markers.

CREATE TABLE IF NOT EXISTS dane_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  code_type VARCHAR(30) NOT NULL,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(160) NOT NULL,
  parent_code VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dane_codes_tenant_type_code
  ON dane_codes (tenant_id, code_type, code, is_deleted);

CREATE INDEX IF NOT EXISTS idx_dane_codes_type_parent
  ON dane_codes (tenant_id, code_type, parent_code, is_active, is_deleted);

CREATE TABLE IF NOT EXISTS document_type_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(80) NOT NULL,
  country VARCHAR(5) NOT NULL DEFAULT 'CO',
  is_national BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_document_type_catalog_tenant_code
  ON document_type_catalog (tenant_id, code, is_deleted);

CREATE TABLE IF NOT EXISTS official_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  report_type VARCHAR(30) NOT NULL,
  academic_year_id UUID REFERENCES academic_years(id),
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  responsible_name VARCHAR(160) NOT NULL,
  file_name VARCHAR(255),
  file_key TEXT,
  file_size_bytes INTEGER,
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_official_reports_tenant_type
  ON official_reports (tenant_id, report_type, report_date, is_deleted);

CREATE INDEX IF NOT EXISTS idx_official_reports_tenant_year
  ON official_reports (tenant_id, academic_year_id, is_deleted);

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS medical_conditions TEXT,
  ADD COLUMN IF NOT EXISTS disability_info TEXT,
  ADD COLUMN IF NOT EXISTS reasonable_adjustments TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pickup_authorized JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sensitive_data_access JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dane_institution_code VARCHAR(30),
  ADD COLUMN IF NOT EXISTS dane_branch_code VARCHAR(30),
  ADD COLUMN IF NOT EXISTS calendar VARCHAR(10),
  ADD COLUMN IF NOT EXISTS zone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS sector VARCHAR(20),
  ADD COLUMN IF NOT EXISTS origin_institution VARCHAR(200),
  ADD COLUMN IF NOT EXISTS origin_grade VARCHAR(80);

ALTER TABLE school_branches
  ADD COLUMN IF NOT EXISTS dane_code VARCHAR(30),
  ADD COLUMN IF NOT EXISTS calendar VARCHAR(10);
