import {
  boolean,
  date,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

const auditColumns = {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  isDeleted: boolean('is_deleted').default(false).notNull(),
}

export const tenants = pgTable('tenants', {
  ...auditColumns,
  name: varchar('name', { length: 160 }).notNull(),
  slug: varchar('slug', { length: 80 }).notNull().unique(),
  nit: varchar('nit', { length: 30 }),
  status: varchar('status', { length: 30 }).default('active').notNull(),
  settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
})

export const schoolBranches = pgTable('school_branches', {
  ...auditColumns,
  name: varchar('name', { length: 160 }).notNull(),
  code: varchar('code', { length: 30 }),
  address: varchar('address', { length: 255 }),
  city: varchar('city', { length: 120 }),
  phone: varchar('phone', { length: 30 }),
})

export const users = pgTable('users', {
  ...auditColumns,
  branchId: uuid('branch_id'),
  fullName: varchar('full_name', { length: 160 }).notNull(),
  email: varchar('email', { length: 160 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  status: varchar('status', { length: 30 }).default('active').notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
})

export const roles = pgTable('roles', {
  ...auditColumns,
  name: varchar('name', { length: 80 }).notNull(),
  code: varchar('code', { length: 60 }).notNull(),
  description: text('description'),
})

export const permissions = pgTable('permissions', {
  ...auditColumns,
  name: varchar('name', { length: 80 }).notNull(),
  code: varchar('code', { length: 80 }).notNull(),
  module: varchar('module', { length: 60 }).notNull(),
  description: text('description'),
})

export const userRoles = pgTable(
  'user_roles',
  {
    ...auditColumns,
    userId: uuid('user_id').notNull(),
    roleId: uuid('role_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.id] })],
)

export const rolePermissions = pgTable(
  'role_permissions',
  {
    ...auditColumns,
    roleId: uuid('role_id').notNull(),
    permissionId: uuid('permission_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.id] })],
)

export const navigationSections = pgTable('navigation_sections', {
  ...auditColumns,
  code: varchar('code', { length: 60 }).notNull(),
  title: varchar('title', { length: 120 }).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => [
  uniqueIndex('uq_navigation_sections_tenant_code').on(table.tenantId, table.code),
  index('idx_navigation_sections_tenant').on(table.tenantId, table.sortOrder, table.isActive, table.isDeleted),
])

export const navigationItems = pgTable('navigation_items', {
  ...auditColumns,
  sectionId: uuid('section_id').notNull(),
  code: varchar('code', { length: 80 }).notNull(),
  label: varchar('label', { length: 120 }).notNull(),
  to: varchar('to', { length: 180 }).notNull(),
  shortLabel: varchar('short_label', { length: 10 }).notNull(),
  badge: integer('badge'),
  sortOrder: integer('sort_order').default(0).notNull(),
  requiredPermission: varchar('required_permission', { length: 80 }),
  mobileVisible: boolean('mobile_visible').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => [
  uniqueIndex('uq_navigation_items_tenant_code').on(table.tenantId, table.code),
  index('idx_navigation_items_tenant').on(table.tenantId, table.sectionId, table.sortOrder, table.isActive, table.isDeleted),
])

export const roleNavigationItems = pgTable(
  'role_navigation_items',
  {
    ...auditColumns,
    roleId: uuid('role_id').notNull(),
    navigationItemId: uuid('navigation_item_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('idx_role_navigation_items_tenant').on(table.tenantId, table.roleId, table.navigationItemId, table.isDeleted),
  ],
)

export const students = pgTable('students', {
  ...auditColumns,
  branchId: uuid('branch_id'),
  firstName: varchar('first_name', { length: 80 }).notNull(),
  middleName: varchar('middle_name', { length: 80 }),
  lastName: varchar('last_name', { length: 80 }).notNull(),
  documentType: varchar('document_type', { length: 20 }).notNull(),
  documentNumber: varchar('document_number', { length: 30 }).notNull(),
  birthDate: date('birth_date'),
  gender: varchar('gender', { length: 20 }),
  bloodType: varchar('blood_type', { length: 10 }),
  status: varchar('status', { length: 30 }).default('active').notNull(),
}, (table) => [
  index('idx_students_tenant_document').on(table.tenantId, table.documentType, table.documentNumber),
  index('idx_students_tenant_status').on(table.tenantId, table.status, table.isDeleted),
])

export const guardians = pgTable('guardians', {
  ...auditColumns,
  fullName: varchar('full_name', { length: 160 }).notNull(),
  firstName: varchar('first_name', { length: 80 }).notNull(),
  lastName: varchar('last_name', { length: 80 }).notNull(),
  documentType: varchar('document_type', { length: 20 }).notNull(),
  documentNumber: varchar('document_number', { length: 30 }).notNull(),
  email: varchar('email', { length: 160 }),
  phone: varchar('phone', { length: 30 }),
  relationship: varchar('relationship', { length: 40 }).notNull(),
}, (table) => [
  index('idx_guardians_tenant_document').on(table.tenantId, table.documentType, table.documentNumber),
  index('idx_guardians_tenant_email').on(table.tenantId, table.email),
])

export const studentGuardians = pgTable(
  'student_guardians',
  {
    ...auditColumns,
    studentId: uuid('student_id').notNull(),
    guardianId: uuid('guardian_id').notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
  },
  (table) => [primaryKey({ columns: [table.id] })],
)

export const teachers = pgTable('teachers', {
  ...auditColumns,
  userId: uuid('user_id'),
  fullName: varchar('full_name', { length: 160 }).notNull(),
  email: varchar('email', { length: 160 }),
  phone: varchar('phone', { length: 30 }),
  specialty: varchar('specialty', { length: 120 }),
  status: varchar('status', { length: 30 }).default('active').notNull(),
  maxWeeklyHours: integer('max_weekly_hours').default(40).notNull(),
})

export const academicYears = pgTable('academic_years', {
  ...auditColumns,
  name: varchar('name', { length: 80 }).notNull(),
  year: integer('year').notNull(),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),
  isActive: boolean('is_active').default(false).notNull(),
})

export const academicPeriods = pgTable('academic_periods', {
  ...auditColumns,
  academicYearId: uuid('academic_year_id').notNull(),
  name: varchar('name', { length: 80 }).notNull(),
  code: varchar('code', { length: 30 }).notNull(),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),
  weight: integer('weight').default(25).notNull(),
  status: varchar('status', { length: 20 }).default('open').notNull(),
})

export const academicAreas = pgTable('academic_areas', {
  ...auditColumns,
  name: varchar('name', { length: 120 }).notNull(),
  code: varchar('code', { length: 30 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 10 }).default('#6366f1'),
  orderNumber: integer('order_number').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => [
  uniqueIndex('uq_academic_areas_tenant_code').on(table.tenantId, table.code),
  index('idx_academic_areas_tenant').on(table.tenantId, table.isActive, table.isDeleted),
])

export const gradingScales = pgTable('grading_scales', {
  ...auditColumns,
  name: varchar('name', { length: 80 }).notNull(),
  minValue: decimal('min_value', { precision: 5, scale: 2 }).notNull(),
  maxValue: decimal('max_value', { precision: 5, scale: 2 }).notNull(),
  passingValue: decimal('passing_value', { precision: 5, scale: 2 }).notNull(),
  decimalPlaces: integer('decimal_places').default(1).notNull(),
  scaleType: varchar('scale_type', { length: 20 }).default('numeric').notNull(), // 'numeric' | 'qualitative' | 'mixed'
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => [
  index('idx_grading_scales_tenant').on(table.tenantId, table.isActive, table.isDeleted),
])

export const performanceRanges = pgTable('performance_ranges', {
  ...auditColumns,
  gradingScaleId: uuid('grading_scale_id').notNull(),
  nationalLevel: varchar('national_level', { length: 20 }).notNull(), // 'SUPERIOR' | 'HIGH' | 'BASIC' | 'LOW'
  institutionalLabel: varchar('institutional_label', { length: 60 }).notNull(),
  minScore: decimal('min_score', { precision: 5, scale: 2 }).notNull(),
  maxScore: decimal('max_score', { precision: 5, scale: 2 }).notNull(),
  isPassing: boolean('is_passing').default(true).notNull(),
  color: varchar('color', { length: 10 }).default('#6366f1'),
  description: text('description'),
}, (table) => [
  index('idx_performance_ranges_scale').on(table.tenantId, table.gradingScaleId, table.isDeleted),
])

export const grades = pgTable('grades', {
  ...auditColumns,
  name: varchar('name', { length: 80 }).notNull(),
  level: integer('level').notNull(),
  levelName: varchar('level_name', { length: 30 }), // 'preschool' | 'primary' | 'secondary' | 'middle'
  orderNumber: integer('order_number').default(0),
})

export const groups = pgTable('groups', {
  ...auditColumns,
  academicYearId: uuid('academic_year_id'),
  gradeId: uuid('grade_id').notNull(),
  branchId: uuid('branch_id'),
  name: varchar('name', { length: 20 }).notNull(),
  capacity: integer('capacity').default(35).notNull(),
}, (table) => [
  index('idx_groups_tenant_year_grade').on(table.tenantId, table.academicYearId, table.gradeId, table.isDeleted),
])

export const teacherResponsibilities = pgTable('teacher_responsibilities', {
  ...auditColumns,
  academicYearId: uuid('academic_year_id').notNull(),
  teacherId: uuid('teacher_id').references(() => teachers.id).notNull(),
  responsibilityType: varchar('responsibility_type', { length: 40 }).notNull(),
  scopeType: varchar('scope_type', { length: 30 }).default('global').notNull(),
  branchId: uuid('branch_id').references(() => schoolBranches.id),
  levelName: varchar('level_name', { length: 30 }),
  gradeId: uuid('grade_id').references(() => grades.id),
  groupId: uuid('group_id').references(() => groups.id),
  title: varchar('title', { length: 120 }),
  notes: text('notes'),
}, (table) => [
  index('idx_teacher_responsibilities_lookup').on(table.tenantId, table.academicYearId, table.responsibilityType, table.isDeleted),
  index('idx_teacher_responsibilities_teacher').on(table.tenantId, table.teacherId, table.isDeleted),
])

export const gradingScaleAssignments = pgTable('grading_scale_assignments', {
  ...auditColumns,
  academicYearId: uuid('academic_year_id').references(() => academicYears.id).notNull(),
  gradingScaleId: uuid('grading_scale_id').references(() => gradingScales.id).notNull(),
  scopeType: varchar('scope_type', { length: 30 }).default('level').notNull(),
  levelName: varchar('level_name', { length: 30 }),
  gradeId: uuid('grade_id').references(() => grades.id),
  title: varchar('title', { length: 120 }),
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => [
  uniqueIndex('uq_grading_scale_assignments_scope').on(table.tenantId, table.academicYearId, table.scopeType, table.levelName, table.gradeId, table.isDeleted),
  index('idx_grading_scale_assignments_lookup').on(table.tenantId, table.academicYearId, table.isActive, table.isDeleted),
])

export const academicYearJourneys = pgTable('academic_year_journeys', {
  ...auditColumns,
  academicYearId: uuid('academic_year_id').references(() => academicYears.id).notNull(),
  branchId: uuid('branch_id').references(() => schoolBranches.id),
  targetLevelName: varchar('target_level_name', { length: 30 }),
  targetGradeId: uuid('target_grade_id').references(() => grades.id),
  name: varchar('name', { length: 80 }).notNull(),
  code: varchar('code', { length: 30 }).notNull(),
  startsAt: varchar('starts_at', { length: 5 }).notNull(),
  endsAt: varchar('ends_at', { length: 5 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => [
  uniqueIndex('uq_academic_year_journeys_scope_code').on(table.tenantId, table.academicYearId, table.branchId, table.code, table.isDeleted),
  index('idx_academic_year_journeys_lookup').on(table.tenantId, table.academicYearId, table.isActive, table.isDeleted),
])

export const academicYearLevels = pgTable('academic_year_levels', {
  ...auditColumns,
  academicYearId: uuid('academic_year_id').references(() => academicYears.id).notNull(),
  journeyId: uuid('journey_id').references(() => academicYearJourneys.id),
  levelCode: varchar('level_code', { length: 30 }).notNull(),
  name: varchar('name', { length: 80 }).notNull(),
  orderNumber: integer('order_number').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => [
  uniqueIndex('uq_academic_year_levels_scope').on(table.tenantId, table.academicYearId, table.journeyId, table.levelCode, table.isDeleted),
  index('idx_academic_year_levels_lookup').on(table.tenantId, table.academicYearId, table.isActive, table.isDeleted),
])

export const academicYearJourneySlots = pgTable('academic_year_journey_slots', {
  ...auditColumns,
  journeyId: uuid('journey_id').references(() => academicYearJourneys.id).notNull(),
  dayOfWeek: varchar('day_of_week', { length: 15 }).notNull(),
  slotOrder: integer('slot_order').notNull(),
  startsAt: varchar('starts_at', { length: 5 }).notNull(),
  endsAt: varchar('ends_at', { length: 5 }).notNull(),
  slotType: varchar('slot_type', { length: 20 }).default('class').notNull(),
  label: varchar('label', { length: 80 }),
}, (table) => [
  uniqueIndex('uq_academic_year_journey_slots_order').on(table.tenantId, table.journeyId, table.dayOfWeek, table.slotOrder, table.isDeleted),
  index('idx_academic_year_journey_slots_lookup').on(table.tenantId, table.journeyId, table.dayOfWeek, table.isDeleted),
])

export const groupJourneyOptions = pgTable('group_journey_options', {
  ...auditColumns,
  academicYearId: uuid('academic_year_id').references(() => academicYears.id).notNull(),
  groupId: uuid('group_id').references(() => groups.id).notNull(),
  journeyId: uuid('journey_id').references(() => academicYearJourneys.id).notNull(),
  priority: integer('priority').default(0).notNull(),
  isPreferred: boolean('is_preferred').default(false).notNull(),
}, (table) => [
  uniqueIndex('uq_group_journey_options_group_journey').on(table.tenantId, table.academicYearId, table.groupId, table.journeyId, table.isDeleted),
  index('idx_group_journey_options_lookup').on(table.tenantId, table.academicYearId, table.groupId, table.isDeleted),
])

export const groupTimetableEntries = pgTable('group_timetable_entries', {
  ...auditColumns,
  academicYearId: uuid('academic_year_id').references(() => academicYears.id).notNull(),
  groupId: uuid('group_id').references(() => groups.id).notNull(),
  journeyId: uuid('journey_id').references(() => academicYearJourneys.id).notNull(),
  journeySlotId: uuid('journey_slot_id').references(() => academicYearJourneySlots.id).notNull(),
  courseSubjectId: uuid('course_subject_id').references(() => courseSubjects.id),
  subjectId: uuid('subject_id').references(() => subjects.id).notNull(),
  teacherId: uuid('teacher_id').references(() => teachers.id),
  dayOfWeek: varchar('day_of_week', { length: 15 }).notNull(),
  slotOrder: integer('slot_order').notNull(),
  entryType: varchar('entry_type', { length: 20 }).default('class').notNull(),
  status: varchar('status', { length: 20 }).default('draft').notNull(),
  notes: text('notes'),
}, (table) => [
  uniqueIndex('uq_group_timetable_entries_group_slot').on(table.tenantId, table.academicYearId, table.groupId, table.dayOfWeek, table.slotOrder, table.isDeleted),
  uniqueIndex('uq_group_timetable_entries_teacher_slot').on(table.tenantId, table.academicYearId, table.teacherId, table.dayOfWeek, table.slotOrder, table.isDeleted),
  index('idx_group_timetable_entries_group').on(table.tenantId, table.academicYearId, table.groupId, table.status, table.isDeleted),
])

export const subjects = pgTable('subjects', {
  ...auditColumns,
  academicAreaId: uuid('academic_area_id'),
  name: varchar('name', { length: 120 }).notNull(),
  code: varchar('code', { length: 30 }).notNull(),
  area: varchar('area', { length: 80 }), // kept for backward compat, use academicAreaId going forward
})

export const courseSubjects = pgTable('course_subjects', {
  ...auditColumns,
  academicYearId: uuid('academic_year_id').notNull(),
  groupId: uuid('group_id').notNull(),
  subjectId: uuid('subject_id').notNull(),
  weeklyHours: integer('weekly_hours').default(4).notNull(),
  teacherId: uuid('teacher_id').references(() => teachers.id),
}, (table) => [
  uniqueIndex('uq_course_subjects_group_subject').on(table.tenantId, table.academicYearId, table.groupId, table.subjectId, table.isDeleted),
  index('idx_course_subjects_year_group').on(table.tenantId, table.academicYearId, table.groupId, table.isDeleted),
])

export const gradeSubjects = pgTable('grade_subjects', {
  ...auditColumns,
  academicYearId: uuid('academic_year_id').notNull(),
  gradeId: uuid('grade_id').notNull(),
  subjectId: uuid('subject_id').notNull(),
  weeklyHours: integer('weekly_hours').default(4).notNull(),
}, (table) => [
  uniqueIndex('uq_grade_subjects_grade_subject').on(table.tenantId, table.academicYearId, table.gradeId, table.subjectId, table.isDeleted),
  index('idx_grade_subjects_year_grade').on(table.tenantId, table.academicYearId, table.gradeId, table.isDeleted),
])

export const competencies = pgTable('competencies', {
  ...auditColumns,
  academicAreaId: uuid('academic_area_id').references(() => academicAreas.id).notNull(),
  subjectId: uuid('subject_id').references(() => subjects.id),
  gradeId: uuid('grade_id').references(() => grades.id),
  name: varchar('name', { length: 160 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  orderNumber: integer('order_number').default(0).notNull(),
}, (table) => [
  index('idx_competencies_area').on(table.tenantId, table.academicAreaId, table.isDeleted),
])

export const learningAchievements = pgTable('learning_achievements', {
  ...auditColumns,
  academicYearId: uuid('academic_year_id').notNull(),
  academicPeriodId: uuid('academic_period_id').notNull(),
  gradeId: uuid('grade_id').notNull(),
  subjectId: uuid('subject_id').notNull(),
  code: varchar('code', { length: 30 }).notNull(),
  title: varchar('title', { length: 160 }).notNull(),
  description: text('description').notNull(),
  weight: integer('weight').default(100).notNull(),
  competencyId: uuid('competency_id').references(() => competencies.id),
  orderNumber: integer('order_number').default(0).notNull(),
  expectedPerformance: varchar('expected_performance', { length: 20 }),
}, (table) => [
  uniqueIndex('uq_learning_achievements_code').on(table.tenantId, table.academicYearId, table.academicPeriodId, table.gradeId, table.subjectId, table.code),
  index('idx_learning_achievements_lookup').on(table.tenantId, table.academicYearId, table.gradeId, table.subjectId, table.academicPeriodId, table.isDeleted),
])

export const achievementIndicators = pgTable('achievement_indicators', {
  ...auditColumns,
  achievementId: uuid('achievement_id').references(() => learningAchievements.id).notNull(),
  description: text('description').notNull(),
  orderNumber: integer('order_number').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => [
  index('idx_achievement_indicators_achievement').on(table.tenantId, table.achievementId, table.isDeleted),
])

export const admissionApplications = pgTable('admission_applications', {
  ...auditColumns,
  studentId: uuid('student_id').notNull(),
  academicYearId: uuid('academic_year_id').notNull(),
  requestedGradeId: uuid('requested_grade_id').notNull(),
  requestedGroupId: uuid('requested_group_id'),
  primaryGuardianId: uuid('primary_guardian_id'),
  status: varchar('status', { length: 30 }).default('draft').notNull(),
  source: varchar('source', { length: 30 }).default('new_student').notNull(),
  applicationDate: timestamp('application_date', { withTimezone: true }).defaultNow().notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewedBy: uuid('reviewed_by'),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  convertedEnrollmentId: uuid('converted_enrollment_id'),
  fixedData: jsonb('fixed_data').$type<Record<string, unknown>>().default({}).notNull(),
  notes: text('notes'),
}, (table) => [
  index('idx_admission_applications_tenant_year_status').on(table.tenantId, table.academicYearId, table.status, table.isDeleted),
  index('idx_admission_applications_tenant_student').on(table.tenantId, table.studentId, table.isDeleted),
])

export const enrollments = pgTable('enrollments', {
  ...auditColumns,
  studentId: uuid('student_id').notNull(),
  academicYearId: uuid('academic_year_id').notNull(),
  gradeId: uuid('grade_id').notNull(),
  groupId: uuid('group_id'),
  admissionApplicationId: uuid('admission_application_id'),
  previousEnrollmentId: uuid('previous_enrollment_id'),
  enrollmentType: varchar('enrollment_type', { length: 30 }).default('new').notNull(),
  enrollmentStatus: varchar('enrollment_status', { length: 30 }).default('draft').notNull(),
  enrollmentDate: timestamp('enrollment_date', { withTimezone: true }).defaultNow().notNull(),
  promotionStatus: varchar('promotion_status', { length: 30 }),
  promotedFromGradeId: uuid('promoted_from_grade_id'),
  fixedData: jsonb('fixed_data').$type<Record<string, unknown>>().default({}).notNull(),
  status: varchar('status', { length: 30 }).default('active').notNull(),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_enrollments_tenant_year_status').on(table.tenantId, table.academicYearId, table.enrollmentStatus, table.isDeleted),
  index('idx_enrollments_tenant_student_year').on(table.tenantId, table.studentId, table.academicYearId),
  index('idx_enrollments_tenant_origin').on(table.tenantId, table.enrollmentType, table.admissionApplicationId),
  uniqueIndex('uq_enrollments_tenant_student_year_active').on(table.tenantId, table.studentId, table.academicYearId, table.isDeleted),
])

export const formTemplates = pgTable('form_templates', {
  ...auditColumns,
  code: varchar('code', { length: 80 }).notNull(),
  name: varchar('name', { length: 160 }).notNull(),
  description: text('description'),
  module: varchar('module', { length: 60 }).default('enrollment').notNull(),
  entityType: varchar('entity_type', { length: 60 }).default('enrollment').notNull(),
  academicYearId: uuid('academic_year_id'),
  startsOn: date('starts_on'),
  endsOn: date('ends_on'),
  status: varchar('status', { length: 30 }).default('active').notNull(),
  activeVersionId: uuid('active_version_id'),
  settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
}, (table) => [
  uniqueIndex('uq_form_templates_tenant_code_year').on(table.tenantId, table.code, table.academicYearId),
  index('idx_form_templates_tenant_module').on(table.tenantId, table.module, table.status, table.isDeleted),
  index('idx_form_templates_tenant_dates').on(table.tenantId, table.startsOn, table.endsOn, table.status, table.isDeleted),
])

export const formTemplateVersions = pgTable('form_template_versions', {
  ...auditColumns,
  formTemplateId: uuid('form_template_id').notNull(),
  versionNumber: integer('version_number').notNull(),
  status: varchar('status', { length: 30 }).default('draft').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  publishedBy: uuid('published_by'),
  clonedFromVersionId: uuid('cloned_from_version_id'),
  schemaSnapshot: jsonb('schema_snapshot').$type<Record<string, unknown>>().default({}).notNull(),
  notes: text('notes'),
}, (table) => [
  uniqueIndex('uq_form_template_versions_template_number').on(table.tenantId, table.formTemplateId, table.versionNumber),
  index('idx_form_template_versions_status').on(table.tenantId, table.formTemplateId, table.status, table.isDeleted),
])

export const formSections = pgTable('form_sections', {
  ...auditColumns,
  formTemplateVersionId: uuid('form_template_version_id').notNull(),
  code: varchar('code', { length: 80 }).notNull(),
  title: varchar('title', { length: 160 }).notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isCollapsible: boolean('is_collapsible').default(true).notNull(),
  isCollapsedByDefault: boolean('is_collapsed_by_default').default(false).notNull(),
  visibilityRules: jsonb('visibility_rules').$type<Record<string, unknown>>().default({}).notNull(),
}, (table) => [
  uniqueIndex('uq_form_sections_version_code').on(table.tenantId, table.formTemplateVersionId, table.code),
  index('idx_form_sections_version_order').on(table.tenantId, table.formTemplateVersionId, table.sortOrder, table.isDeleted),
])

export const formFields = pgTable('form_fields', {
  ...auditColumns,
  formTemplateVersionId: uuid('form_template_version_id').notNull(),
  formSectionId: uuid('form_section_id').notNull(),
  code: varchar('code', { length: 80 }).notNull(),
  label: varchar('label', { length: 160 }).notNull(),
  helpText: text('help_text'),
  fieldType: varchar('field_type', { length: 30 }).notNull(),
  dataKey: varchar('data_key', { length: 120 }),
  sortOrder: integer('sort_order').default(0).notNull(),
  isRequired: boolean('is_required').default(false).notNull(),
  isSearchable: boolean('is_searchable').default(false).notNull(),
  isReportable: boolean('is_reportable').default(false).notNull(),
  options: jsonb('options').$type<Array<Record<string, unknown>>>().default([]).notNull(),
  validationRules: jsonb('validation_rules').$type<Record<string, unknown>>().default({}).notNull(),
  visibilityRules: jsonb('visibility_rules').$type<Record<string, unknown>>().default({}).notNull(),
  defaultValue: jsonb('default_value').$type<unknown>(),
  placeholder: varchar('placeholder', { length: 160 }),
}, (table) => [
  uniqueIndex('uq_form_fields_version_code').on(table.tenantId, table.formTemplateVersionId, table.code),
  index('idx_form_fields_version_section_order').on(table.tenantId, table.formTemplateVersionId, table.formSectionId, table.sortOrder, table.isDeleted),
  index('idx_form_fields_reportable').on(table.tenantId, table.formTemplateVersionId, table.isReportable, table.isSearchable),
])

export const formSubmissions = pgTable('form_submissions', {
  ...auditColumns,
  formTemplateId: uuid('form_template_id').notNull(),
  formTemplateVersionId: uuid('form_template_version_id').notNull(),
  academicYearId: uuid('academic_year_id'),
  admissionApplicationId: uuid('admission_application_id'),
  enrollmentId: uuid('enrollment_id'),
  studentId: uuid('student_id'),
  submittedByGuardianId: uuid('submitted_by_guardian_id'),
  status: varchar('status', { length: 30 }).default('draft').notNull(),
  progressPercent: integer('progress_percent').default(0).notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  lastAutosavedAt: timestamp('last_autosaved_at', { withTimezone: true }),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  schemaSnapshot: jsonb('schema_snapshot').$type<Record<string, unknown>>().default({}).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
}, (table) => [
  index('idx_form_submissions_tenant_template_status').on(table.tenantId, table.formTemplateId, table.status, table.isDeleted),
  index('idx_form_submissions_tenant_student_year').on(table.tenantId, table.studentId, table.academicYearId),
  index('idx_form_submissions_tenant_admission').on(table.tenantId, table.admissionApplicationId),
  index('idx_form_submissions_tenant_enrollment').on(table.tenantId, table.enrollmentId),
])

export const formFieldValues = pgTable('form_field_values', {
  ...auditColumns,
  formSubmissionId: uuid('form_submission_id').notNull(),
  formFieldId: uuid('form_field_id').notNull(),
  formSectionId: uuid('form_section_id').notNull(),
  fieldCode: varchar('field_code', { length: 80 }).notNull(),
  fieldType: varchar('field_type', { length: 30 }).notNull(),
  fieldLabelSnapshot: varchar('field_label_snapshot', { length: 160 }).notNull(),
  sectionTitleSnapshot: varchar('section_title_snapshot', { length: 160 }).notNull(),
  valueText: text('value_text'),
  valueNumber: decimal('value_number', { precision: 14, scale: 4 }),
  valueBoolean: boolean('value_boolean'),
  valueDate: date('value_date'),
  valueTimestamp: timestamp('value_timestamp', { withTimezone: true }),
  valueJson: jsonb('value_json').$type<unknown>(),
  searchableValue: text('searchable_value'),
  validationStatus: varchar('validation_status', { length: 30 }).default('valid').notNull(),
}, (table) => [
  uniqueIndex('uq_form_field_values_submission_field').on(table.tenantId, table.formSubmissionId, table.formFieldId),
  index('idx_form_field_values_code_text').on(table.tenantId, table.fieldCode, table.searchableValue),
  index('idx_form_field_values_code_number').on(table.tenantId, table.fieldCode, table.valueNumber),
  index('idx_form_field_values_code_date').on(table.tenantId, table.fieldCode, table.valueDate),
])

export const requiredDocuments = pgTable('required_documents', {
  ...auditColumns,
  formTemplateVersionId: uuid('form_template_version_id').notNull(),
  code: varchar('code', { length: 80 }).notNull(),
  name: varchar('name', { length: 160 }).notNull(),
  description: text('description'),
  isRequired: boolean('is_required').default(true).notNull(),
  acceptedMimeTypes: jsonb('accepted_mime_types').$type<string[]>().default([]).notNull(),
  maxFileSizeMb: integer('max_file_size_mb').default(10).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  validationRules: jsonb('validation_rules').$type<Record<string, unknown>>().default({}).notNull(),
}, (table) => [
  uniqueIndex('uq_required_documents_version_code').on(table.tenantId, table.formTemplateVersionId, table.code),
  index('idx_required_documents_version_order').on(table.tenantId, table.formTemplateVersionId, table.sortOrder, table.isDeleted),
])

export const uploadedDocuments = pgTable('uploaded_documents', {
  ...auditColumns,
  requiredDocumentId: uuid('required_document_id').notNull(),
  formSubmissionId: uuid('form_submission_id').notNull(),
  studentId: uuid('student_id'),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileKey: text('file_key').notNull(),
  mimeType: varchar('mime_type', { length: 120 }).notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  checksum: varchar('checksum', { length: 128 }),
  status: varchar('status', { length: 30 }).default('uploaded').notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewedBy: uuid('reviewed_by'),
  rejectionReason: text('rejection_reason'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
}, (table) => [
  index('idx_uploaded_documents_submission').on(table.tenantId, table.formSubmissionId, table.status, table.isDeleted),
  index('idx_uploaded_documents_student').on(table.tenantId, table.studentId, table.status),
])

export const attendanceRecords = pgTable('attendance_records', {
  ...auditColumns,
  studentId: uuid('student_id').notNull(),
  groupId: uuid('group_id'),
  subjectId: uuid('subject_id'),
  attendanceDate: date('attendance_date').notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  notes: text('notes'),
  academicYearId: uuid('academic_year_id'),
  academicPeriodId: uuid('academic_period_id'),
  justified: boolean('justified').default(false).notNull(),
})

export const gradeRecords = pgTable('grade_records', {
  ...auditColumns,
  studentId: uuid('student_id').notNull(),
  subjectId: uuid('subject_id').notNull(),
  academicPeriodId: uuid('academic_period_id').notNull(),
  score: decimal('score', { precision: 5, scale: 2 }).notNull(),
  gradeValue: varchar('grade_value', { length: 80 }),
  gradeValueType: varchar('grade_value_type', { length: 20 }).default('numeric').notNull(),
  maxScore: decimal('max_score', { precision: 5, scale: 2 }).default('5.00').notNull(),
  notes: text('notes'),
  groupId: uuid('group_id'),
  academicYearId: uuid('academic_year_id'),
})

export const studentObservations = pgTable('student_observations', {
  ...auditColumns,
  studentId: uuid('student_id').notNull(),
  category: varchar('category', { length: 40 }).notNull(),
  observation: text('observation').notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true }).defaultNow().notNull(),
})

export const invoiceAccounts = pgTable('invoice_accounts', {
  ...auditColumns,
  studentId: uuid('student_id').notNull(),
  concept: varchar('concept', { length: 120 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  dueDate: date('due_date').notNull(),
  status: varchar('status', { length: 30 }).default('pending').notNull(),
})

export const payments = pgTable('payments', {
  ...auditColumns,
  invoiceAccountId: uuid('invoice_account_id').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  paymentDate: timestamp('payment_date', { withTimezone: true }).defaultNow().notNull(),
  method: varchar('method', { length: 30 }).notNull(),
  reference: varchar('reference', { length: 80 }),
})

export const announcements = pgTable('announcements', {
  ...auditColumns,
  title: varchar('title', { length: 180 }).notNull(),
  body: text('body').notNull(),
  audience: varchar('audience', { length: 60 }).default('all').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
})

export const notificationLogs = pgTable('notification_logs', {
  ...auditColumns,
  channel: varchar('channel', { length: 30 }).notNull(),
  recipient: varchar('recipient', { length: 160 }).notNull(),
  template: varchar('template', { length: 80 }),
  payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
  status: varchar('status', { length: 30 }).default('queued').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
})

export const auditLogs = pgTable('audit_logs', {
  ...auditColumns,
  actorUserId: uuid('actor_user_id'),
  entity: varchar('entity', { length: 80 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 30 }).notNull(),
  changes: jsonb('changes').$type<Record<string, unknown>>().default({}).notNull(),
  ipAddress: varchar('ip_address', { length: 60 }),
})

export const evaluationActivities = pgTable('evaluation_activities', {
  ...auditColumns,
  academicYearId: uuid('academic_year_id').notNull(),
  academicPeriodId: uuid('academic_period_id').notNull(),
  groupId: uuid('group_id').notNull(),
  subjectId: uuid('subject_id').notNull(),
  achievementId: uuid('achievement_id').references(() => learningAchievements.id).notNull(),
  teacherId: uuid('teacher_id').references(() => teachers.id),
  name: varchar('name', { length: 160 }).notNull(),
  description: text('description'),
  activityType: varchar('activity_type', { length: 30 }).notNull(),
  weightPercentage: decimal('weight_percentage', { precision: 5, scale: 2 }).notNull(),
  maxScore: decimal('max_score', { precision: 5, scale: 2 }).default('5.00').notNull(),
  dueDate: date('due_date'),
  isPublished: boolean('is_published').default(false).notNull(),
}, (table) => [
  index('idx_evaluation_activities_lookup').on(table.tenantId, table.academicYearId, table.academicPeriodId, table.groupId, table.subjectId, table.isDeleted),
])

export const activityScores = pgTable('activity_scores', {
  ...auditColumns,
  activityId: uuid('activity_id').references(() => evaluationActivities.id).notNull(),
  studentId: uuid('student_id').references(() => students.id).notNull(),
  score: decimal('score', { precision: 5, scale: 2 }).notNull(),
  performanceLevel: varchar('performance_level', { length: 20 }),
  observations: text('observations'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  gradedAt: timestamp('graded_at', { withTimezone: true }),
  gradedBy: uuid('graded_by'),
}, (table) => [
  uniqueIndex('uq_activity_scores_student').on(table.tenantId, table.activityId, table.studentId),
  index('idx_activity_scores_student').on(table.tenantId, table.studentId),
])

export const academicObservations = pgTable('academic_observations', {
  ...auditColumns,
  academicYearId: uuid('academic_year_id').notNull(),
  academicPeriodId: uuid('academic_period_id').notNull(),
  studentId: uuid('student_id').references(() => students.id).notNull(),
  subjectId: uuid('subject_id').references(() => subjects.id).notNull(),
  achievementId: uuid('achievement_id').references(() => learningAchievements.id),
  observationType: varchar('observation_type', { length: 30 }).notNull(),
  text: text('text').notNull(),
}, (table) => [
  index('idx_academic_observations_lookup').on(table.tenantId, table.academicYearId, table.academicPeriodId, table.studentId, table.subjectId, table.isDeleted),
])

export const observationBank = pgTable('observation_bank', {
  ...auditColumns,
  subjectId: uuid('subject_id').references(() => subjects.id),
  gradeId: uuid('grade_id').references(() => grades.id),
  performanceLevel: varchar('performance_level', { length: 20 }),
  observationType: varchar('observation_type', { length: 30 }).notNull(),
  text: text('text').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => [
  index('idx_observation_bank_lookup').on(table.tenantId, table.isDeleted),
])

export const supportStrategies = pgTable('support_strategies', {
  ...auditColumns,
  academicYearId: uuid('academic_year_id').notNull(),
  academicPeriodId: uuid('academic_period_id').notNull(),
  studentId: uuid('student_id').references(() => students.id).notNull(),
  subjectId: uuid('subject_id').references(() => subjects.id).notNull(),
  achievementId: uuid('achievement_id').references(() => learningAchievements.id),
  teacherId: uuid('teacher_id').references(() => teachers.id),
  description: text('description').notNull(),
  dueDate: date('due_date'),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  resultScore: decimal('result_score', { precision: 5, scale: 2 }),
}, (table) => [
  index('idx_support_strategies_lookup').on(table.tenantId, table.academicYearId, table.academicPeriodId, table.studentId, table.subjectId, table.isDeleted),
])
