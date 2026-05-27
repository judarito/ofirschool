import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  tenantId: z.uuid().optional(),
})

export const studentSchema = z.object({
  firstName: z.string().min(2).max(80),
  middleName: z.string().max(80).optional().or(z.literal('')).or(z.null()),
  lastName: z.string().min(2).max(80),
  documentType: z.string().min(2).max(20),
  documentNumber: z.string().min(5).max(30),
  birthDate: z.string().date().optional().or(z.literal('')).or(z.null()),
  gender: z.string().min(1).max(20),
  bloodType: z.string().max(10).optional().or(z.literal('')).or(z.null()),
  status: z.enum(['active', 'inactive']).default('active'),
})

export const guardianSchema = z.object({
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  documentType: z.string().min(2).max(20),
  documentNumber: z.string().min(5).max(30),
  phone: z.string().min(7).max(30),
  email: z.email(),
  relationship: z.string().min(2).max(40),
})

const answerValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string()),
  z.array(z.number()),
  z.array(z.boolean()),
])

export const publicAdmissionSubmissionSchema = z.object({
  submissionToken: z.uuid(),
  formTemplateId: z.uuid(),
  formTemplateVersionId: z.uuid(),
  student: studentSchema.omit({ status: true }).extend({
    birthDate: z.string().date(),
    gender: z.string().min(1).max(20),
  }),
  guardian: guardianSchema,
  admission: z.object({
    requestedGradeId: z.uuid(),
    requestedGroupId: z.uuid().optional().or(z.literal('')).or(z.null()),
    source: z.enum(['new_student', 'transfer', 'reentry']).default('new_student'),
    notes: z.string().max(1200).optional().or(z.literal('')).or(z.null()),
  }),
  answers: z.record(z.string(), answerValueSchema).default({}),
  documents: z.array(
    z.object({
      documentCode: z.string().min(1).max(80),
      fileName: z.string().min(1).max(255),
      mimeType: z.string().max(120).optional().or(z.literal('')).or(z.null()),
      fileSizeBytes: z.number().int().nonnegative().optional().or(z.null()),
    }),
  ).default([]),
})

export const studentFiltersSchema = z.object({
  query: z.string().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  gradeId: z.uuid().optional().or(z.literal('')).or(z.null()),
  groupId: z.uuid().optional().or(z.literal('')).or(z.null()),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
})

export const studentAdmissionProfileSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

export const paginationSchema = z.object({
  query: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
})

export const admissionFiltersSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  status: z.string().max(40).optional(),
  gradeId: z.uuid().optional().or(z.literal('')).or(z.null()),
  groupId: z.uuid().optional().or(z.literal('')).or(z.null()),
  query: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
})

export const admissionStatusUpdateSchema = z.object({
  status: z.enum(['reviewing', 'accepted', 'rejected']),
  notes: z.string().max(1200).optional().or(z.literal('')).or(z.null()),
})

export const academicYearSchema = z.object({
  name: z.string().min(3).max(80),
  year: z.coerce.number().int().min(2000).max(2100),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  status: z.enum(['activo', 'planeado']).default('planeado'),
})

export const academicPeriodSchema = z.object({
  academicYearId: z.uuid(),
  name: z.string().min(2).max(80),
  code: z.string().min(1).max(30),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  weight: z.coerce.number().int().min(0).max(100).default(25),
})

export const academicPeriodStatusSchema = z.object({
  status: z.enum(['open', 'published', 'closed']),
})

export const academicGradeSchema = z.object({
  name: z.string().min(2).max(80),
  level: z.coerce.number().int().min(-2).max(20),
  levelName: z.enum(['preschool', 'primary', 'secondary', 'middle']).optional().or(z.literal('')).or(z.null()),
  orderNumber: z.coerce.number().int().min(0).default(0).optional(),
})

export const academicYearLevelSchema = z.object({
  academicYearId: z.uuid(),
  journeyId: z.uuid().optional().or(z.literal('')).or(z.null()),
  levelCode: z.enum(['preschool', 'primary', 'secondary', 'middle']),
  name: z.string().min(2).max(80),
  orderNumber: z.coerce.number().int().min(0).default(0).optional(),
  isActive: z.boolean().default(true).optional(),
})

export const courseSchema = z.object({
  academicYearId: z.uuid(),
  gradeId: z.uuid(),
  branchId: z.uuid().optional().or(z.literal('')).or(z.null()),
  name: z.string().min(1).max(20),
  capacity: z.coerce.number().int().min(1).max(80).default(35),
})

export const subjectSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(1).max(30),
  area: z.string().max(80).optional().or(z.literal('')).or(z.null()),
  academicAreaId: z.uuid().optional().or(z.literal('')).or(z.null()),
})

export const gradeSubjectSchema = z.object({
  academicYearId: z.uuid(),
  gradeId: z.uuid(),
  subjectId: z.uuid(),
  weeklyHours: z.coerce.number().int().min(1).max(20).default(4),
})

export const academicAreaSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(1).max(30),
  description: z.string().max(1000).optional().or(z.literal('')).or(z.null()),
  color: z.string().max(10).optional().or(z.literal('')).or(z.null()),
  orderNumber: z.coerce.number().int().min(0).default(0).optional(),
  isActive: z.boolean().default(true).optional(),
})

export const gradingScaleSchema = z.object({
  name: z.string().min(2).max(80),
  minValue: z.coerce.number().min(0).max(100),
  maxValue: z.coerce.number().min(0).max(100),
  passingValue: z.coerce.number().min(0).max(100),
  decimalPlaces: z.coerce.number().int().min(0).max(5).default(1),
  scaleType: z.enum(['numeric', 'qualitative', 'mixed']).default('numeric'),
  isActive: z.boolean().default(true).optional(),
})

export const performanceRangeSchema = z.object({
  gradingScaleId: z.uuid(),
  nationalLevel: z.enum(['SUPERIOR', 'HIGH', 'BASIC', 'LOW']),
  institutionalLabel: z.string().min(1).max(60),
  minScore: z.coerce.number().min(0).max(100),
  maxScore: z.coerce.number().min(0).max(100),
  isPassing: z.boolean().default(true).optional(),
  color: z.string().max(10).optional().or(z.literal('')).or(z.null()),
  description: z.string().max(1000).optional().or(z.literal('')).or(z.null()),
})

export const competencySchema = z.object({
  academicAreaId: z.uuid(),
  subjectId: z.uuid().optional().or(z.literal('')).or(z.null()),
  gradeId: z.uuid().optional().or(z.literal('')).or(z.null()),
  name: z.string().min(3).max(160),
  description: z.string().max(1000).optional().or(z.literal('')).or(z.null()),
  isActive: z.boolean().default(true).optional(),
  orderNumber: z.coerce.number().int().min(0).default(0),
})

export const achievementIndicatorSchema = z.object({
  achievementId: z.uuid(),
  description: z.string().min(3).max(2000),
  orderNumber: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true).optional(),
})

export const achievementSchema = z.object({
  academicYearId: z.uuid(),
  academicPeriodId: z.uuid(),
  gradeId: z.uuid(),
  subjectId: z.uuid(),
  code: z.string().min(1).max(30),
  title: z.string().min(3).max(160),
  description: z.string().min(3).max(2000),
  weight: z.coerce.number().int().min(1).max(100).default(100),
  competencyId: z.uuid().optional().or(z.literal('')).or(z.null()),
  orderNumber: z.coerce.number().int().min(0).default(0),
  expectedPerformance: z.enum(['SUPERIOR', 'HIGH', 'BASIC', 'LOW']).optional().or(z.literal('')).or(z.null()),
})

export const achievementFiltersSchema = z.object({
  academicYearId: z.uuid().optional().or(z.literal('')).or(z.null()),
  academicPeriodId: z.uuid().optional().or(z.literal('')).or(z.null()),
  gradeId: z.uuid().optional().or(z.literal('')).or(z.null()),
  subjectId: z.uuid().optional().or(z.literal('')).or(z.null()),
  query: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
})

export const gradebookFiltersSchema = z.object({
  academicYearId: z.uuid(),
  groupId: z.uuid(),
  subjectId: z.uuid(),
  academicPeriodId: z.uuid(),
})

export const reportCardFiltersSchema = z.object({
  academicYearId: z.uuid(),
  academicPeriodId: z.uuid(),
  studentId: z.uuid(),
})

export const annualReportCardFiltersSchema = z.object({
  academicYearId: z.uuid(),
  studentId: z.uuid(),
})

export const gradebookSaveSchema = z.object({
  academicYearId: z.uuid(),
  groupId: z.uuid(),
  subjectId: z.uuid(),
  academicPeriodId: z.uuid(),
  items: z.array(z.object({
    studentId: z.uuid(),
    score: z.coerce.number().min(0).max(100),
    maxScore: z.coerce.number().min(0.1).max(100).default(5),
    notes: z.string().max(1200).optional().or(z.literal('')).or(z.null()),
  })).min(1).max(500),
})

export const attendanceFiltersSchema = z.object({
  academicYearId: z.uuid(),
  groupId: z.uuid(),
  subjectId: z.uuid(),
  academicPeriodId: z.uuid(),
  attendanceDate: z.string().date(),
})

export const attendanceSaveSchema = z.object({
  academicYearId: z.uuid(),
  groupId: z.uuid(),
  subjectId: z.uuid(),
  academicPeriodId: z.uuid(),
  attendanceDate: z.string().date(),
  items: z.array(z.object({
    studentId: z.uuid(),
    status: z.enum(['present', 'absent', 'late', 'excused']),
    justified: z.boolean().default(false),
    notes: z.string().max(500).optional().or(z.literal('')).or(z.null()),
  })).min(1).max(500),
})

const selectOptionSchema = z.object({
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(120),
})

const formFieldEditorSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(160),
  type: z.enum([
    'text',
    'textarea',
    'number',
    'decimal',
    'date',
    'datetime',
    'checkbox',
    'radio',
    'select',
    'multiselect',
    'email',
    'phone',
    'file',
    'document_number',
    'city',
    'department',
    'address',
  ]),
  required: z.boolean().default(false),
  options: z.array(selectOptionSchema).default([]),
})

const formSectionEditorSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(160),
  description: z.string().max(255).default(''),
  fields: z.array(formFieldEditorSchema).default([]),
})

const requiredDocumentEditorSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  required: z.boolean().default(true),
  maxSizeMb: z.coerce.number().int().min(1).max(50).default(10),
})

export const enrollmentFormEditorSchema = z.object({
  name: z.string().min(3).max(160),
  year: z.coerce.number().int().min(2000).max(2100),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  autosave: z.boolean().default(true),
  progressBar: z.boolean().default(true),
  sections: z.array(formSectionEditorSchema).default([]),
  documents: z.array(requiredDocumentEditorSchema).default([]),
})

export const admissionProcessSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  name: z.string().min(3).max(160),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
})

export const manualAdmissionSchema = z.object({
  academicYearId: z.uuid(),
  requestedGradeId: z.uuid(),
  requestedGroupId: z.uuid().optional().or(z.literal('')).or(z.null()),
  source: z.enum(['new_student', 'transfer', 'reentry']).default('new_student'),
  notes: z.string().max(1200).optional().or(z.literal('')).or(z.null()),
  student: studentSchema.omit({ status: true }).extend({
    birthDate: z.string().date(),
    gender: z.string().min(1).max(20),
  }),
  guardian: guardianSchema,
})

export const enrollmentCreateSchema = z.object({
  studentId: z.uuid(),
  academicYearId: z.uuid(),
  gradeId: z.uuid(),
  groupId: z.uuid().optional().or(z.literal('')).or(z.null()),
  admissionApplicationId: z.uuid().optional().or(z.literal('')).or(z.null()),
  previousEnrollmentId: z.uuid().optional().or(z.literal('')).or(z.null()),
  enrollmentType: z.enum(['new', 'renewal', 'promotion', 'auto_promotion', 'transfer']).default('new'),
  enrollmentStatus: z.enum(['draft', 'pending', 'active', 'cancelled']).default('draft'),
  enrollmentDate: z.string().date(),
})

export const enrollmentFiltersSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  gradeId: z.uuid().optional().or(z.literal('')).or(z.null()),
  groupId: z.uuid().optional().or(z.literal('')).or(z.null()),
  query: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
})

export const annualPromotionPreviewSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  gradeId: z.uuid().optional().or(z.literal('')).or(z.null()),
  groupId: z.uuid().optional().or(z.literal('')).or(z.null()),
  query: z.string().optional(),
})

export const annualPromotionDecisionSchema = z.object({
  academicYearId: z.uuid(),
  items: z.array(z.object({
    enrollmentId: z.uuid(),
    promotionStatus: z.enum(['pending', 'promoted', 'not_promoted', 'conditional']),
  })).min(1).max(1000),
})

export const enrollmentCandidateFiltersSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  query: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
})

export const enrollmentContinuityPreviewSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  mode: z.enum(['renewal', 'promotion', 'auto_promotion']),
  sourceGradeId: z.uuid().optional().or(z.literal('')).or(z.null()),
  query: z.string().optional(),
})

export const enrollmentBatchCreateSchema = z.object({
  academicYearId: z.uuid(),
  mode: z.enum(['renewal', 'promotion', 'auto_promotion']),
  enrollmentStatus: z.enum(['draft', 'pending', 'active', 'cancelled']).default('pending'),
  enrollmentDate: z.string().date(),
  items: z.array(
    z.object({
      studentId: z.uuid(),
      previousEnrollmentId: z.uuid(),
      gradeId: z.uuid(),
      groupId: z.uuid().optional().or(z.literal('')).or(z.null()),
    }),
  ).min(1).max(500),
})

export const admissionConversionSchema = z.object({
  academicYearId: z.uuid(),
  gradeId: z.uuid(),
  groupId: z.uuid().optional().or(z.literal('')).or(z.null()),
  enrollmentStatus: z.enum(['draft', 'pending', 'active', 'cancelled']).default('active'),
  enrollmentDate: z.string().date(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type StudentInput = z.infer<typeof studentSchema>
export type GuardianInput = z.infer<typeof guardianSchema>
export type StudentFiltersInput = z.infer<typeof studentFiltersSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
export type AdmissionStatusUpdateInput = z.infer<typeof admissionStatusUpdateSchema>
export type AcademicYearInput = z.infer<typeof academicYearSchema>
export type AcademicPeriodInput = z.infer<typeof academicPeriodSchema>
export type AcademicGradeInput = z.infer<typeof academicGradeSchema>
export type CourseInput = z.infer<typeof courseSchema>
export type PublicAdmissionSubmissionInput = z.infer<typeof publicAdmissionSubmissionSchema>
export type EnrollmentFormEditorInput = z.infer<typeof enrollmentFormEditorSchema>
export type AdmissionProcessInput = z.infer<typeof admissionProcessSchema>
export type ManualAdmissionInput = z.infer<typeof manualAdmissionSchema>
export type EnrollmentCreateInput = z.infer<typeof enrollmentCreateSchema>
export type EnrollmentFiltersInput = z.infer<typeof enrollmentFiltersSchema>
export type EnrollmentCandidateFiltersInput = z.infer<typeof enrollmentCandidateFiltersSchema>
export type EnrollmentContinuityPreviewInput = z.infer<typeof enrollmentContinuityPreviewSchema>
export type EnrollmentBatchCreateInput = z.infer<typeof enrollmentBatchCreateSchema>
export type AdmissionConversionInput = z.infer<typeof admissionConversionSchema>

// ─── SIEE Phase 3 Schemas ────────────────────────────────────────────

export const evaluationActivitySchema = z.object({
  academicYearId: z.uuid(),
  academicPeriodId: z.uuid(),
  groupId: z.uuid(),
  subjectId: z.uuid(),
  achievementId: z.uuid(),
  teacherId: z.uuid().optional().or(z.literal('')).or(z.null()),
  name: z.string().min(3).max(160),
  description: z.string().max(2000).optional().or(z.literal('')).or(z.null()),
  activityType: z.enum(['homework', 'exam', 'quiz', 'project', 'class_participation', 'other']),
  weightPercentage: z.coerce.number().min(1).max(100),
  maxScore: z.coerce.number().min(1).max(100).default(5),
  dueDate: z.string().date().optional().or(z.literal('')).or(z.null()),
  isPublished: z.boolean().default(false).optional(),
})

export const activityScoreSchema = z.object({
  activityId: z.uuid(),
  studentId: z.uuid(),
  score: z.coerce.number().min(0).max(100),
  performanceLevel: z.string().max(20).optional().or(z.literal('')).or(z.null()),
  observations: z.string().max(2000).optional().or(z.literal('')).or(z.null()),
})

export const academicObservationSchema = z.object({
  academicYearId: z.uuid(),
  academicPeriodId: z.uuid(),
  studentId: z.uuid(),
  subjectId: z.uuid(),
  achievementId: z.uuid().optional().or(z.literal('')).or(z.null()),
  observationType: z.enum(['strength', 'difficulty', 'recommendation', 'general', 'recovery_plan']),
  text: z.string().min(3).max(4000),
})

export const observationBankSchema = z.object({
  subjectId: z.uuid().optional().or(z.literal('')).or(z.null()),
  gradeId: z.uuid().optional().or(z.literal('')).or(z.null()),
  performanceLevel: z.enum(['SUPERIOR', 'HIGH', 'BASIC', 'LOW']).optional().or(z.literal('')).or(z.null()),
  observationType: z.enum(['strength', 'difficulty', 'recommendation', 'general']),
  text: z.string().min(3).max(4000),
  isActive: z.boolean().default(true).optional(),
})

export const supportStrategySchema = z.object({
  academicYearId: z.uuid(),
  academicPeriodId: z.uuid(),
  studentId: z.uuid(),
  subjectId: z.uuid(),
  achievementId: z.uuid().optional().or(z.literal('')).or(z.null()),
  teacherId: z.uuid().optional().or(z.literal('')).or(z.null()),
  description: z.string().min(3).max(4000),
  dueDate: z.string().date().optional().or(z.literal('')).or(z.null()),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'approved']).default('pending'),
  resultScore: z.coerce.number().min(0).max(100).optional().or(z.null()),
})

export type EvaluationActivityInput = z.infer<typeof evaluationActivitySchema>
export type ActivityScoreInput = z.infer<typeof activityScoreSchema>
export type AcademicObservationInput = z.infer<typeof academicObservationSchema>
export type ObservationBankInput = z.infer<typeof observationBankSchema>
export type SupportStrategyInput = z.infer<typeof supportStrategySchema>

export const teacherSchema = z.object({
  userId: z.uuid().optional().or(z.literal('')).or(z.null()),
  fullName: z.string().min(2).max(160),
  email: z.string().email().optional().or(z.literal('')).or(z.null()),
  phone: z.string().max(30).optional().or(z.literal('')).or(z.null()),
  specialty: z.string().max(120).optional().or(z.literal('')).or(z.null()),
  status: z.enum(['active', 'inactive']).default('active'),
  maxWeeklyHours: z.coerce.number().int().min(1).max(168).default(40),
})

export const courseSubjectSchema = z.object({
  academicYearId: z.uuid(),
  groupId: z.uuid(),
  subjectId: z.uuid(),
  weeklyHours: z.coerce.number().int().min(1).max(40).default(4),
  teacherId: z.uuid().optional().or(z.literal('')).or(z.null()),
})

export const teacherResponsibilitySchema = z.object({
  academicYearId: z.uuid(),
  teacherId: z.uuid(),
  responsibilityType: z.enum(['group_director', 'coordinator']),
  scopeType: z.enum(['global', 'branch', 'level', 'grade', 'group']).default('global'),
  branchId: z.uuid().optional().or(z.literal('')).or(z.null()),
  levelName: z.enum(['preschool', 'primary', 'secondary', 'middle']).optional().or(z.literal('')).or(z.null()),
  gradeId: z.uuid().optional().or(z.literal('')).or(z.null()),
  groupId: z.uuid().optional().or(z.literal('')).or(z.null()),
  title: z.string().min(2).max(120).optional().or(z.literal('')).or(z.null()),
  notes: z.string().max(1000).optional().or(z.literal('')).or(z.null()),
})

export const gradingScaleAssignmentSchema = z.object({
  academicYearId: z.uuid(),
  gradingScaleId: z.uuid(),
  scopeType: z.enum(['level', 'grade']).default('level'),
  levelName: z.enum(['preschool', 'primary', 'secondary', 'middle']).optional().or(z.literal('')).or(z.null()),
  gradeId: z.uuid().optional().or(z.literal('')).or(z.null()),
  title: z.string().max(120).optional().or(z.literal('')).or(z.null()),
  isActive: z.coerce.boolean().default(true),
})

const hourMinuteSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
const dayOfWeekSchema = z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])

export const academicYearJourneySchema = z.object({
  academicYearId: z.uuid(),
  branchId: z.uuid().optional().or(z.literal('')).or(z.null()),
  targetLevelName: z.enum(['preschool', 'primary', 'secondary', 'middle']).optional().or(z.literal('')).or(z.null()),
  targetGradeId: z.uuid().optional().or(z.literal('')).or(z.null()),
  name: z.string().min(2).max(80),
  code: z.string().min(2).max(30),
  startsAt: hourMinuteSchema,
  endsAt: hourMinuteSchema,
  isActive: z.coerce.boolean().default(true),
})

export const academicYearJourneySlotSchema = z.object({
  journeyId: z.uuid(),
  dayOfWeek: dayOfWeekSchema,
  slotOrder: z.coerce.number().int().min(1).max(20),
  startsAt: hourMinuteSchema,
  endsAt: hourMinuteSchema,
  slotType: z.enum(['class', 'break', 'homeroom', 'lunch', 'institutional']).default('class'),
  label: z.string().max(80).optional().or(z.literal('')).or(z.null()),
})

export const groupJourneyOptionSchema = z.object({
  academicYearId: z.uuid(),
  groupId: z.uuid(),
  journeyId: z.uuid(),
  priority: z.coerce.number().int().min(0).max(100).default(0),
  isPreferred: z.coerce.boolean().default(false),
})

export const timetableGenerationSchema = z.object({
  academicYearId: z.uuid(),
  groupIds: z.array(z.uuid()).default([]),
  overwriteExisting: z.coerce.boolean().default(true),
})

export const timetableEntryUpdateSchema = z.object({
  journeyId: z.uuid(),
  journeySlotId: z.uuid(),
  notes: z.string().max(1000).optional().or(z.literal('')).or(z.null()),
})

export const timetableStatusSchema = z.object({
  academicYearId: z.uuid(),
  groupId: z.uuid().optional().or(z.literal('')).or(z.null()),
  journeyId: z.uuid().optional().or(z.literal('')).or(z.null()),
  status: z.enum(['draft', 'published', 'locked']),
})

export const userManagementCreateSchema = z.object({
  fullName: z.string().min(2).max(160),
  email: z.string().email(),
  password: z.string().min(8).max(120),
  status: z.enum(['active', 'inactive']).default('active'),
  roleCodes: z.array(z.string().min(1).max(60)).default([]),
})

export const userManagementUpdateSchema = z.object({
  fullName: z.string().min(2).max(160),
  email: z.string().email(),
  password: z.string().min(8).max(120).optional().or(z.literal('')).or(z.null()),
  status: z.enum(['active', 'inactive']).default('active'),
  roleCodes: z.array(z.string().min(1).max(60)).default([]),
})

export type TeacherInput = z.infer<typeof teacherSchema>
export type CourseSubjectInput = z.infer<typeof courseSubjectSchema>
export type TeacherResponsibilityInput = z.infer<typeof teacherResponsibilitySchema>
export type AcademicYearJourneyInput = z.infer<typeof academicYearJourneySchema>
export type AcademicYearJourneySlotInput = z.infer<typeof academicYearJourneySlotSchema>
export type GroupJourneyOptionInput = z.infer<typeof groupJourneyOptionSchema>
export type TimetableGenerationInput = z.infer<typeof timetableGenerationSchema>
export type TimetableEntryUpdateInput = z.infer<typeof timetableEntryUpdateSchema>
export type TimetableStatusInput = z.infer<typeof timetableStatusSchema>
export type UserManagementCreateInput = z.infer<typeof userManagementCreateSchema>
export type UserManagementUpdateInput = z.infer<typeof userManagementUpdateSchema>
