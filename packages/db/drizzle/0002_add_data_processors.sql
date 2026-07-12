CREATE TABLE IF NOT EXISTS "data_processors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"name" varchar(200) NOT NULL,
	"business_name" varchar(200),
	"nit" varchar(20),
	"country" varchar(100) NOT NULL,
	"purpose" text NOT NULL,
	"data_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contact_email" varchar(200),
	"contact_phone" varchar(40),
	"has_data_processing_agreement" boolean DEFAULT false NOT NULL,
	"agreement_signed_at" timestamp with time zone,
	"agreement_document_url" varchar(500),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_data_processors_tenant" ON "data_processors" USING btree ("tenant_id","is_deleted");
CREATE INDEX IF NOT EXISTS "idx_data_processors_active" ON "data_processors" USING btree ("tenant_id","is_active","is_deleted");
