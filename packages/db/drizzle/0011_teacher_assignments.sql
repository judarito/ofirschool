-- Migration: 0011_teacher_assignments.sql
-- Add max_weekly_hours to teachers
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS max_weekly_hours INTEGER DEFAULT 40 NOT NULL;

-- Add teacher_id to course_subjects
ALTER TABLE course_subjects ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES teachers(id);
