CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  name varchar(160) NOT NULL,
  slug varchar(80) NOT NULL UNIQUE,
  nit varchar(30),
  status varchar(30) NOT NULL DEFAULT 'active',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS school_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  name varchar(160) NOT NULL,
  code varchar(30),
  address varchar(255),
  city varchar(120),
  phone varchar(30)
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  branch_id uuid,
  full_name varchar(160) NOT NULL,
  email varchar(160) NOT NULL,
  password_hash text NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'active',
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  name varchar(80) NOT NULL,
  code varchar(60) NOT NULL,
  description text
);

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  name varchar(80) NOT NULL,
  code varchar(80) NOT NULL,
  module varchar(60) NOT NULL,
  description text
);

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  user_id uuid NOT NULL,
  role_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  branch_id uuid,
  first_name varchar(80) NOT NULL,
  last_name varchar(80) NOT NULL,
  document_type varchar(20) NOT NULL,
  document_number varchar(30) NOT NULL,
  birth_date date,
  gender varchar(20),
  status varchar(30) NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  full_name varchar(160) NOT NULL,
  email varchar(160),
  phone varchar(30),
  relationship varchar(40),
  document_number varchar(30)
);

CREATE TABLE IF NOT EXISTS student_guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  student_id uuid NOT NULL,
  guardian_id uuid NOT NULL,
  is_primary boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  user_id uuid,
  full_name varchar(160) NOT NULL,
  email varchar(160),
  phone varchar(30),
  specialty varchar(120),
  status varchar(30) NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  name varchar(80) NOT NULL,
  year integer NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  is_active boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS academic_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  academic_year_id uuid NOT NULL,
  name varchar(80) NOT NULL,
  code varchar(30) NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  weight integer NOT NULL DEFAULT 25
);

CREATE TABLE IF NOT EXISTS grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  name varchar(80) NOT NULL,
  level integer NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  grade_id uuid NOT NULL,
  branch_id uuid,
  name varchar(20) NOT NULL,
  capacity integer NOT NULL DEFAULT 35
);

CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  name varchar(120) NOT NULL,
  code varchar(30) NOT NULL,
  area varchar(80)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  student_id uuid NOT NULL,
  academic_year_id uuid NOT NULL,
  grade_id uuid NOT NULL,
  group_id uuid,
  status varchar(30) NOT NULL DEFAULT 'active',
  enrolled_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  student_id uuid NOT NULL,
  group_id uuid,
  subject_id uuid,
  attendance_date date NOT NULL,
  status varchar(20) NOT NULL,
  notes text
);

CREATE TABLE IF NOT EXISTS grade_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  student_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  academic_period_id uuid NOT NULL,
  score numeric(5,2) NOT NULL,
  max_score numeric(5,2) NOT NULL DEFAULT 5.00,
  notes text
);

CREATE TABLE IF NOT EXISTS student_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  student_id uuid NOT NULL,
  category varchar(40) NOT NULL,
  observation text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  student_id uuid NOT NULL,
  concept varchar(120) NOT NULL,
  amount numeric(12,2) NOT NULL,
  due_date date NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  invoice_account_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  payment_date timestamptz NOT NULL DEFAULT now(),
  method varchar(30) NOT NULL,
  reference varchar(80)
);

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  title varchar(180) NOT NULL,
  body text NOT NULL,
  audience varchar(60) NOT NULL DEFAULT 'all',
  published_at timestamptz
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  channel varchar(30) NOT NULL,
  recipient varchar(160) NOT NULL,
  template varchar(80),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(30) NOT NULL DEFAULT 'queued',
  sent_at timestamptz
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  actor_user_id uuid,
  entity varchar(80) NOT NULL,
  entity_id uuid NOT NULL,
  action varchar(30) NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address varchar(60)
);
