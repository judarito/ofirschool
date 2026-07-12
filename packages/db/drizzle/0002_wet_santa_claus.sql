CREATE TABLE "academic_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"academic_period_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"achievement_id" uuid,
	"observation_type" varchar(30) NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academic_year_journey_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"journey_id" uuid NOT NULL,
	"day_of_week" varchar(15) NOT NULL,
	"slot_order" integer NOT NULL,
	"starts_at" varchar(5) NOT NULL,
	"ends_at" varchar(5) NOT NULL,
	"slot_type" varchar(20) DEFAULT 'class' NOT NULL,
	"label" varchar(80)
);
--> statement-breakpoint
CREATE TABLE "academic_year_journeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"branch_id" uuid,
	"target_level_name" varchar(30),
	"target_grade_id" uuid,
	"name" varchar(80) NOT NULL,
	"code" varchar(30) NOT NULL,
	"starts_at" varchar(5) NOT NULL,
	"ends_at" varchar(5) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academic_year_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"journey_id" uuid,
	"level_code" varchar(30) NOT NULL,
	"name" varchar(80) NOT NULL,
	"order_number" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"activity_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"performance_level" varchar(20),
	"observations" text,
	"submitted_at" timestamp with time zone,
	"graded_at" timestamp with time zone,
	"graded_by" uuid
);
--> statement-breakpoint
CREATE TABLE "admission_decision_reasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"code" varchar(60) NOT NULL,
	"outcome" varchar(30) NOT NULL,
	"label" varchar(160) NOT NULL,
	"description" text,
	"requires_observation" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admission_document_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"admission_application_id" uuid NOT NULL,
	"uploaded_document_id" uuid NOT NULL,
	"status" varchar(30) NOT NULL,
	"reason_code" varchar(60),
	"reason_label" varchar(160),
	"notes" text,
	"requested_correction" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "admission_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"admission_application_id" uuid NOT NULL,
	"from_status" varchar(30),
	"to_status" varchar(30) NOT NULL,
	"actor_user_id" uuid,
	"actor_role" varchar(40),
	"decision_code" varchar(60),
	"decision_label" varchar(160),
	"is_internal" boolean DEFAULT true NOT NULL,
	"is_visible_to_family" boolean DEFAULT true NOT NULL,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"document_type" varchar(40) NOT NULL,
	"version" varchar(40) NOT NULL,
	"body" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" date,
	"superseded_by" uuid
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"consent_document_id" uuid NOT NULL,
	"student_id" uuid,
	"guardian_id" uuid,
	"admission_application_id" uuid,
	"enrollment_id" uuid,
	"form_submission_id" uuid,
	"accepted_by_name" varchar(160) NOT NULL,
	"accepted_by_document" varchar(40),
	"accepted_by_relationship" varchar(40),
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"channel" varchar(30) NOT NULL,
	"ip_address" varchar(60),
	"user_agent" text,
	"text_snapshot" text NOT NULL,
	"version" varchar(40) NOT NULL,
	"status" varchar(30) DEFAULT 'accepted' NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revocation_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"academic_period_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"achievement_id" uuid NOT NULL,
	"teacher_id" uuid,
	"name" varchar(160) NOT NULL,
	"description" text,
	"activity_type" varchar(30) NOT NULL,
	"weight_percentage" numeric(5, 2) NOT NULL,
	"max_score" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"due_date" date,
	"is_published" boolean DEFAULT false NOT NULL
);
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
CREATE TABLE "group_journey_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"journey_id" uuid NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_preferred" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_timetable_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"journey_id" uuid NOT NULL,
	"journey_slot_id" uuid NOT NULL,
	"course_subject_id" uuid,
	"subject_id" uuid NOT NULL,
	"teacher_id" uuid,
	"day_of_week" varchar(15) NOT NULL,
	"slot_order" integer NOT NULL,
	"entry_type" varchar(20) DEFAULT 'class' NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "navigation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"section_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"label" varchar(120) NOT NULL,
	"to" varchar(180) NOT NULL,
	"short_label" varchar(10) NOT NULL,
	"badge" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"required_permission" varchar(80),
	"mobile_visible" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigation_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"code" varchar(60) NOT NULL,
	"title" varchar(120) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observation_bank" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"subject_id" uuid,
	"grade_id" uuid,
	"performance_level" varchar(20),
	"observation_type" varchar(30) NOT NULL,
	"text" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_navigation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"role_id" uuid NOT NULL,
	"navigation_item_id" uuid NOT NULL,
	CONSTRAINT "role_navigation_items_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE TABLE "support_strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"academic_period_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"achievement_id" uuid,
	"teacher_id" uuid,
	"description" text NOT NULL,
	"due_date" date,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"result_score" numeric(5, 2)
);
--> statement-breakpoint
CREATE TABLE "teacher_responsibilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"responsibility_type" varchar(40) NOT NULL,
	"scope_type" varchar(30) DEFAULT 'global' NOT NULL,
	"branch_id" uuid,
	"level_name" varchar(30),
	"grade_id" uuid,
	"group_id" uuid,
	"title" varchar(120),
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "academic_periods" ADD COLUMN "status" varchar(20) DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "academic_year_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "academic_period_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "justified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "course_subjects" ADD COLUMN "teacher_id" uuid;--> statement-breakpoint
ALTER TABLE "grade_records" ADD COLUMN "grade_value" varchar(80);--> statement-breakpoint
ALTER TABLE "grade_records" ADD COLUMN "grade_value_type" varchar(20) DEFAULT 'numeric' NOT NULL;--> statement-breakpoint
ALTER TABLE "grade_records" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "grade_records" ADD COLUMN "academic_year_id" uuid;--> statement-breakpoint
ALTER TABLE "guardians" ADD COLUMN "document_expedition_place" varchar(100);--> statement-breakpoint
ALTER TABLE "guardians" ADD COLUMN "address" varchar(200);--> statement-breakpoint
ALTER TABLE "guardians" ADD COLUMN "city" varchar(100);--> statement-breakpoint
ALTER TABLE "guardians" ADD COLUMN "department" varchar(100);--> statement-breakpoint
ALTER TABLE "guardians" ADD COLUMN "occupation" varchar(100);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "document_expedition_place" varchar(100);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "eps" varchar(100);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "sisben_level" varchar(20);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "address" varchar(200);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "city" varchar(100);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "department" varchar(100);--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN "max_weekly_hours" integer DEFAULT 40 NOT NULL;--> statement-breakpoint
ALTER TABLE "academic_observations" ADD CONSTRAINT "academic_observations_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_observations" ADD CONSTRAINT "academic_observations_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_observations" ADD CONSTRAINT "academic_observations_achievement_id_learning_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."learning_achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_year_journey_slots" ADD CONSTRAINT "academic_year_journey_slots_journey_id_academic_year_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."academic_year_journeys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_year_journeys" ADD CONSTRAINT "academic_year_journeys_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_year_journeys" ADD CONSTRAINT "academic_year_journeys_branch_id_school_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."school_branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_year_journeys" ADD CONSTRAINT "academic_year_journeys_target_grade_id_grades_id_fk" FOREIGN KEY ("target_grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_year_levels" ADD CONSTRAINT "academic_year_levels_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_year_levels" ADD CONSTRAINT "academic_year_levels_journey_id_academic_year_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."academic_year_journeys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_scores" ADD CONSTRAINT "activity_scores_activity_id_evaluation_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."evaluation_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_scores" ADD CONSTRAINT "activity_scores_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_document_reviews" ADD CONSTRAINT "admission_document_reviews_admission_application_id_admission_applications_id_fk" FOREIGN KEY ("admission_application_id") REFERENCES "public"."admission_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_document_reviews" ADD CONSTRAINT "admission_document_reviews_uploaded_document_id_uploaded_documents_id_fk" FOREIGN KEY ("uploaded_document_id") REFERENCES "public"."uploaded_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_status_history" ADD CONSTRAINT "admission_status_history_admission_application_id_admission_applications_id_fk" FOREIGN KEY ("admission_application_id") REFERENCES "public"."admission_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_consent_document_id_consent_documents_id_fk" FOREIGN KEY ("consent_document_id") REFERENCES "public"."consent_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_guardian_id_guardians_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_admission_application_id_admission_applications_id_fk" FOREIGN KEY ("admission_application_id") REFERENCES "public"."admission_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_form_submission_id_form_submissions_id_fk" FOREIGN KEY ("form_submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_activities" ADD CONSTRAINT "evaluation_activities_achievement_id_learning_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."learning_achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_activities" ADD CONSTRAINT "evaluation_activities_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_scale_assignments" ADD CONSTRAINT "grading_scale_assignments_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_scale_assignments" ADD CONSTRAINT "grading_scale_assignments_grading_scale_id_grading_scales_id_fk" FOREIGN KEY ("grading_scale_id") REFERENCES "public"."grading_scales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_scale_assignments" ADD CONSTRAINT "grading_scale_assignments_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_journey_options" ADD CONSTRAINT "group_journey_options_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_journey_options" ADD CONSTRAINT "group_journey_options_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_journey_options" ADD CONSTRAINT "group_journey_options_journey_id_academic_year_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."academic_year_journeys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_timetable_entries" ADD CONSTRAINT "group_timetable_entries_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_timetable_entries" ADD CONSTRAINT "group_timetable_entries_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_timetable_entries" ADD CONSTRAINT "group_timetable_entries_journey_id_academic_year_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."academic_year_journeys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_timetable_entries" ADD CONSTRAINT "group_timetable_entries_journey_slot_id_academic_year_journey_slots_id_fk" FOREIGN KEY ("journey_slot_id") REFERENCES "public"."academic_year_journey_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_timetable_entries" ADD CONSTRAINT "group_timetable_entries_course_subject_id_course_subjects_id_fk" FOREIGN KEY ("course_subject_id") REFERENCES "public"."course_subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_timetable_entries" ADD CONSTRAINT "group_timetable_entries_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_timetable_entries" ADD CONSTRAINT "group_timetable_entries_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_bank" ADD CONSTRAINT "observation_bank_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_bank" ADD CONSTRAINT "observation_bank_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_strategies" ADD CONSTRAINT "support_strategies_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_strategies" ADD CONSTRAINT "support_strategies_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_strategies" ADD CONSTRAINT "support_strategies_achievement_id_learning_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."learning_achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_strategies" ADD CONSTRAINT "support_strategies_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_responsibilities" ADD CONSTRAINT "teacher_responsibilities_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_responsibilities" ADD CONSTRAINT "teacher_responsibilities_branch_id_school_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."school_branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_responsibilities" ADD CONSTRAINT "teacher_responsibilities_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_responsibilities" ADD CONSTRAINT "teacher_responsibilities_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_academic_observations_lookup" ON "academic_observations" USING btree ("tenant_id","academic_year_id","academic_period_id","student_id","subject_id","is_deleted");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_academic_year_journey_slots_order" ON "academic_year_journey_slots" USING btree ("tenant_id","journey_id","day_of_week","slot_order","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_academic_year_journey_slots_lookup" ON "academic_year_journey_slots" USING btree ("tenant_id","journey_id","day_of_week","is_deleted");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_academic_year_journeys_scope_code" ON "academic_year_journeys" USING btree ("tenant_id","academic_year_id","branch_id","code","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_academic_year_journeys_lookup" ON "academic_year_journeys" USING btree ("tenant_id","academic_year_id","is_active","is_deleted");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_academic_year_levels_scope" ON "academic_year_levels" USING btree ("tenant_id","academic_year_id","journey_id","level_code","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_academic_year_levels_lookup" ON "academic_year_levels" USING btree ("tenant_id","academic_year_id","is_active","is_deleted");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_activity_scores_student" ON "activity_scores" USING btree ("tenant_id","activity_id","student_id");--> statement-breakpoint
CREATE INDEX "idx_activity_scores_student" ON "activity_scores" USING btree ("tenant_id","student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_admission_decision_reasons_tenant_code" ON "admission_decision_reasons" USING btree ("tenant_id","code","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_admission_decision_reasons_outcome" ON "admission_decision_reasons" USING btree ("tenant_id","outcome","is_active","is_deleted");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_admission_document_reviews_document" ON "admission_document_reviews" USING btree ("tenant_id","uploaded_document_id","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_admission_document_reviews_application" ON "admission_document_reviews" USING btree ("tenant_id","admission_application_id","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_admission_document_reviews_status" ON "admission_document_reviews" USING btree ("tenant_id","status","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_admission_status_history_application" ON "admission_status_history" USING btree ("tenant_id","admission_application_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_admission_status_history_status" ON "admission_status_history" USING btree ("tenant_id","to_status","is_deleted");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_consent_documents_tenant_code_version" ON "consent_documents" USING btree ("tenant_id","code","version","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_consent_documents_tenant_active" ON "consent_documents" USING btree ("tenant_id","code","is_active","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_consents_tenant_document" ON "consents" USING btree ("tenant_id","consent_document_id","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_consents_tenant_student" ON "consents" USING btree ("tenant_id","student_id","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_consents_tenant_admission" ON "consents" USING btree ("tenant_id","admission_application_id","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_consents_tenant_enrollment" ON "consents" USING btree ("tenant_id","enrollment_id","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_consents_tenant_status" ON "consents" USING btree ("tenant_id","status","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_evaluation_activities_lookup" ON "evaluation_activities" USING btree ("tenant_id","academic_year_id","academic_period_id","group_id","subject_id","is_deleted");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_grading_scale_assignments_scope" ON "grading_scale_assignments" USING btree ("tenant_id","academic_year_id","scope_type","level_name","grade_id","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_grading_scale_assignments_lookup" ON "grading_scale_assignments" USING btree ("tenant_id","academic_year_id","is_active","is_deleted");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_group_journey_options_group_journey" ON "group_journey_options" USING btree ("tenant_id","academic_year_id","group_id","journey_id","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_group_journey_options_lookup" ON "group_journey_options" USING btree ("tenant_id","academic_year_id","group_id","is_deleted");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_group_timetable_entries_group_slot" ON "group_timetable_entries" USING btree ("tenant_id","academic_year_id","group_id","day_of_week","slot_order","is_deleted");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_group_timetable_entries_teacher_slot" ON "group_timetable_entries" USING btree ("tenant_id","academic_year_id","teacher_id","day_of_week","slot_order","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_group_timetable_entries_group" ON "group_timetable_entries" USING btree ("tenant_id","academic_year_id","group_id","status","is_deleted");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_navigation_items_tenant_code" ON "navigation_items" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "idx_navigation_items_tenant" ON "navigation_items" USING btree ("tenant_id","section_id","sort_order","is_active","is_deleted");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_navigation_sections_tenant_code" ON "navigation_sections" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "idx_navigation_sections_tenant" ON "navigation_sections" USING btree ("tenant_id","sort_order","is_active","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_observation_bank_lookup" ON "observation_bank" USING btree ("tenant_id","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_role_navigation_items_tenant" ON "role_navigation_items" USING btree ("tenant_id","role_id","navigation_item_id","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_support_strategies_lookup" ON "support_strategies" USING btree ("tenant_id","academic_year_id","academic_period_id","student_id","subject_id","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_teacher_responsibilities_lookup" ON "teacher_responsibilities" USING btree ("tenant_id","academic_year_id","responsibility_type","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_teacher_responsibilities_teacher" ON "teacher_responsibilities" USING btree ("tenant_id","teacher_id","is_deleted");--> statement-breakpoint
ALTER TABLE "course_subjects" ADD CONSTRAINT "course_subjects_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;