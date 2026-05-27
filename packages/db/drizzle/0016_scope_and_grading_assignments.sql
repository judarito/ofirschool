ALTER TABLE "teacher_responsibilities"
ADD COLUMN "scope_type" varchar(30) DEFAULT 'global' NOT NULL,
ADD COLUMN "branch_id" uuid,
ADD COLUMN "level_name" varchar(30),
ADD COLUMN "grade_id" uuid;
--> statement-breakpoint
CREATE TABLE "grading_scale_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "academic_year_id" uuid NOT NULL,
  "grading_scale_id" uuid NOT NULL,
  "scope_type" varchar(30) DEFAULT 'level' NOT NULL,
  "level_name" varchar(30),
  "grade_id" uuid,
  "title" varchar(120),
  "is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_grading_scale_assignments_scope" ON "grading_scale_assignments" USING btree ("tenant_id","academic_year_id","scope_type","level_name","grade_id","is_deleted");
--> statement-breakpoint
CREATE INDEX "idx_grading_scale_assignments_lookup" ON "grading_scale_assignments" USING btree ("tenant_id","academic_year_id","is_active","is_deleted");
