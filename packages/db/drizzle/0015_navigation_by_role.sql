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
CREATE TABLE "role_navigation_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "role_id" uuid NOT NULL,
  "navigation_item_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_navigation_sections_tenant_code" ON "navigation_sections" USING btree ("tenant_id","code");
--> statement-breakpoint
CREATE INDEX "idx_navigation_sections_tenant" ON "navigation_sections" USING btree ("tenant_id","sort_order","is_active","is_deleted");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_navigation_items_tenant_code" ON "navigation_items" USING btree ("tenant_id","code");
--> statement-breakpoint
CREATE INDEX "idx_navigation_items_tenant" ON "navigation_items" USING btree ("tenant_id","section_id","sort_order","is_active","is_deleted");
--> statement-breakpoint
CREATE INDEX "idx_role_navigation_items_tenant" ON "role_navigation_items" USING btree ("tenant_id","role_id","navigation_item_id","is_deleted");
