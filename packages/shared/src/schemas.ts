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
  documentExpeditionPlace: z.string().max(100).optional().or(z.literal('')).or(z.null()),
  birthDate: z.string().date().optional().or(z.literal('')).or(z.null()),
  gender: z.string().min(1).max(20),
  bloodType: z.string().max(10).optional().or(z.literal('')).or(z.null()),
  eps: z.string().max(100).optional().or(z.literal('')).or(z.null()),
  sisbenLevel: z.string().max(20).optional().or(z.literal('')).or(z.null()),
  address: z.string().max(200).optional().or(z.literal('')).or(z.null()),
  city: z.string().max(100).optional().or(z.literal('')).or(z.null()),
  department: z.string().max(100).optional().or(z.literal('')).or(z.null()),
  status: z.enum(['active', 'inactive']).default('active'),
})

export const guardianSchema = z.object({
  firstName: z.string().min(2).max(80),
  middleName: z.string().max(80).optional().or(z.literal('')).or(z.null()),
  lastName: z.string().min(2).max(80),
  documentType: z.string().min(2).max(20),
  documentNumber: z.string().min(5).max(30),
  documentExpeditionPlace: z.string().max(100).optional().or(z.literal('')).or(z.null()),
  email: z.email(),
  phone: z.string().min(7).max(30),
  relationship: z.string().min(2).max(40),
  address: z.string().max(200).optional().or(z.literal('')).or(z.null()),
  city: z.string().max(100).optional().or(z.literal('')).or(z.null()),
  department: z.string().max(100).optional().or(z.literal('')).or(z.null()),
  occupation: z.string().max(100).optional().or(z.literal('')).or(z.null()),
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
  consents: z.array(
    z.object({
      documentCode: z.string().min(1).max(80),
      accepted: z.literal(true),
      acceptedByName: z.string().min(2).max(160),
      acceptedByRelationship: z.string().min(2).max(40).optional().or(z.literal('')).or(z.null()),
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
  branchId: z.uuid().optional().or(z.literal('')).or(z.null()),
  gradeId: z.uuid().optional().or(z.literal('')).or(z.null()),
  groupId: z.uuid().optional().or(z.literal('')).or(z.null()),
  assignedTo: z.uuid().optional().or(z.literal('')).or(z.null()),
  source: z.enum(['new_student', 'transfer', 'reentry']).optional().or(z.literal('')).or(z.null()),
  documentStatus: z.string().max(30).optional().or(z.literal('')).or(z.null()),
  dateFrom: z.string().date().optional().or(z.literal('')).or(z.null()),
  dateTo: z.string().date().optional().or(z.literal('')).or(z.null()),
  query: z.string().optional(),
  export: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
})

export const admissionStatusUpdateSchema = z.object({
  status: z.enum(['document_review', 'needs_correction', 'interview_scheduled', 'committee_review', 'waitlisted', 'accepted_conditional', 'reviewing', 'accepted', 'rejected']),
  notes: z.string().max(1200).optional().or(z.literal('')).or(z.null()),
  decisionCode: z.string().min(2).max(60).optional().or(z.literal('')).or(z.null()),
  observation: z.string().max(2000).optional().or(z.literal('')).or(z.null()),
  isInternal: z.boolean().default(true).optional(),
  isVisibleToFamily: z.boolean().default(true).optional(),
  confirmDuplicateReview: z.boolean().optional(),
})

export const admissionDecisionReasonSchema = z.object({
  code: z.string().min(2).max(60),
  outcome: z.enum(['accepted', 'accepted_conditional', 'rejected', 'needs_correction', 'waitlisted']),
  label: z.string().min(3).max(160),
  description: z.string().max(1000).optional().or(z.literal('')).or(z.null()),
  requiresObservation: z.boolean().default(false).optional(),
  sortOrder: z.coerce.number().int().default(0).optional(),
  isActive: z.boolean().default(true).optional(),
})

export const admissionDocumentReviewSchema = z.object({
  status: z.enum(['approved', 'rejected', 'needs_correction']),
  reasonCode: z.string().min(2).max(60).optional().or(z.literal('')).or(z.null()),
  reasonLabel: z.string().max(160).optional().or(z.literal('')).or(z.null()),
  notes: z.string().max(2000).optional().or(z.literal('')).or(z.null()),
  requestedCorrection: z.string().max(2000).optional().or(z.literal('')).or(z.null()),
})

// ─── Acudientes, responsables y novedades de matrícula ────────────────

export const guardianRelationshipTypeSchema = z.enum([
  'academic_guardian',
  'legal_representative',
  'financial_responsible',
  'emergency_contact',
  'pickup_authorized',
  'other',
])

export const studentGuardianLinkSchema = z.object({
  guardianId: z.uuid(),
  relationship: z.string().min(2).max(40),
  relationshipType: guardianRelationshipTypeSchema.default('academic_guardian'),
  relationshipLabel: z.string().max(80).optional().or(z.literal('')).or(z.null()),
  isPrimary: z.boolean().default(false),
  isLegalRepresentative: z.boolean().default(false),
  isFinancialResponsible: z.boolean().default(false),
  isEmergencyContact: z.boolean().default(false),
  isPickupAuthorized: z.boolean().default(true),
})

export const enrollmentNoveltyTypeSchema = z.enum([
  'withdrawal',
  'transfer',
  'group_change',
  'branch_change',
  'reentry',
  'graduation',
  'cancellation',
])

export const enrollmentNoveltyCreateSchema = z.object({
  enrollmentId: z.uuid(),
  noveltyType: enrollmentNoveltyTypeSchema,
  effectiveDate: z.string().date(),
  reasonCode: z.string().min(2).max(60).optional().or(z.literal('')).or(z.null()),
  reasonLabel: z.string().max(160).optional().or(z.literal('')).or(z.null()),
  notes: z.string().max(2000).optional().or(z.literal('')).or(z.null()),
  toGradeId: z.uuid().optional().or(z.literal('')).or(z.null()),
  toGroupId: z.uuid().optional().or(z.literal('')).or(z.null()),
  destinationInstitution: z.string().max(200).optional().or(z.literal('')).or(z.null()),
  documentReference: z.string().max(120).optional().or(z.literal('')).or(z.null()),
})

export const enrollmentUpdateSchema = z.object({
  journey: z.string().min(2).max(40).optional().or(z.literal('')).or(z.null()),
  branchId: z.uuid().optional().or(z.literal('')).or(z.null()),
  signedAt: z.string().datetime().optional().or(z.literal('')).or(z.null()),
  documentStatus: z.enum(['pending', 'partial', 'complete', 'rejected']).optional(),
  financialStatus: z.enum(['pending', 'partial', 'complete', 'overdue']).optional(),
  academicStatus: z.enum(['pending', 'placed', 'cancelled']).optional(),
  enrollmentStatus: z.enum(['draft', 'pending', 'active', 'cancelled', 'withdrawn']).optional(),
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
  applicantTypes: z.array(z.enum(['new_student', 'transfer', 'reentry'])).default([]),
})

export const enrollmentFormEditorSchema = z.object({
  name: z.string().min(3).max(160),
  year: z.coerce.number().int().min(2000).max(2100),
  gradeId: z.uuid().optional().or(z.literal('')).or(z.null()),
  branchId: z.uuid().optional().or(z.literal('')).or(z.null()),
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
  answers: z.record(z.string(), answerValueSchema).default({}),
})

export const admissionUpdateSchema = z.object({
  requestedGradeId: z.uuid(),
  requestedGroupId: z.uuid().optional().or(z.literal('')).or(z.null()),
  source: z.enum(['new_student', 'transfer', 'reentry']).default('new_student'),
  notes: z.string().max(1200).optional().or(z.literal('')).or(z.null()),
  guardian: guardianSchema,
})

export const enrollmentCreateSchema = z.object({
  studentId: z.uuid(),
  academicYearId: z.uuid(),
  gradeId: z.uuid(),
  groupId: z.uuid().optional().or(z.literal('')).or(z.null()),
  branchId: z.uuid().optional().or(z.literal('')).or(z.null()),
  journey: z.string().max(40).optional().or(z.literal('')).or(z.null()),
  admissionApplicationId: z.uuid().optional().or(z.literal('')).or(z.null()),
  previousEnrollmentId: z.uuid().optional().or(z.literal('')).or(z.null()),
  enrollmentType: z.enum(['new', 'renewal', 'promotion', 'auto_promotion', 'transfer']).default('new'),
  enrollmentStatus: z.enum(['draft', 'pending', 'active', 'cancelled']).default('draft'),
  enrollmentDate: z.string().date(),
  approveAdmissionIfNeeded: z.boolean().default(false).optional(),
})

export const enrollmentFiltersSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  branchId: z.uuid().optional().or(z.literal('')).or(z.null()),
  gradeId: z.uuid().optional().or(z.literal('')).or(z.null()),
  groupId: z.uuid().optional().or(z.literal('')).or(z.null()),
  status: z.string().max(30).optional().or(z.literal('')).or(z.null()),
  documentStatus: z.string().max(30).optional().or(z.literal('')).or(z.null()),
  financialStatus: z.string().max(30).optional().or(z.literal('')).or(z.null()),
  academicStatus: z.string().max(30).optional().or(z.literal('')).or(z.null()),
  query: z.string().optional(),
  export: z.coerce.boolean().optional(),
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
  branchId: z.uuid().optional().or(z.literal('')).or(z.null()),
  journey: z.string().max(40).optional().or(z.literal('')).or(z.null()),
  enrollmentStatus: z.enum(['draft', 'pending', 'active', 'cancelled']).default('active'),
  enrollmentDate: z.string().date(),
})

// ─── Consentimientos versionados (Ley 1581 de 2012) ───────────────────

export const consentDocumentTypeSchema = z.enum([
  'privacy_notice',
  'data_treatment_authorization',
  'image_rights',
  'school_transport',
  'medical_authorization',
  'academic_publication',
  'enrollment_contract',
  'promissory_note',
  'other',
])

export const consentDocumentCreateSchema = z.object({
  code: z.string().min(2).max(80),
  name: z.string().min(3).max(160),
  description: z.string().max(2000).optional().or(z.literal('')).or(z.null()),
  documentType: consentDocumentTypeSchema,
  version: z.string().min(1).max(40),
  body: z.string().min(10).max(20000),
  effectiveFrom: z.string().date().optional().or(z.literal('')).or(z.null()),
  isActive: z.boolean().default(true).optional(),
})

export const consentDocumentUpdateSchema = consentDocumentCreateSchema.extend({
  id: z.uuid(),
  supersededBy: z.uuid().optional().or(z.literal('')).or(z.null()),
})

export const consentAcceptanceSchema = z.object({
  documentCode: z.string().min(2).max(80),
  version: z.string().min(1).max(40),
  acceptedByName: z.string().min(2).max(160),
  acceptedByRelationship: z.string().min(2).max(40).optional().or(z.literal('')).or(z.null()),
  studentId: z.uuid().optional().or(z.literal('')).or(z.null()),
  guardianId: z.uuid().optional().or(z.literal('')).or(z.null()),
  admissionApplicationId: z.uuid().optional().or(z.literal('')).or(z.null()),
  enrollmentId: z.uuid().optional().or(z.literal('')).or(z.null()),
  formSubmissionId: z.uuid().optional().or(z.literal('')).or(z.null()),
  channel: z.enum(['public_form', 'admin_panel', 'in_person', 'email', 'other']).default('admin_panel'),
  notes: z.string().max(1000).optional().or(z.literal('')).or(z.null()),
})

export const consentRevocationSchema = z.object({
  reason: z.string().min(3).max(1000),
})

export type ConsentDocumentCreateInput = z.infer<typeof consentDocumentCreateSchema>
export type ConsentDocumentUpdateInput = z.infer<typeof consentDocumentUpdateSchema>
export type ConsentAcceptanceInput = z.infer<typeof consentAcceptanceSchema>
export type ConsentRevocationInput = z.infer<typeof consentRevocationSchema>
export const admissionAssignmentSchema = z.object({
  assignedTo: z.uuid().nullable(),
})

export const admissionCommentCreateSchema = z.object({
  content: z.string().min(1).max(2000),
  isInternalOnly: z.boolean().default(true),
})

export type AdmissionStatusUpdateInput = z.infer<typeof admissionStatusUpdateSchema>
export type AdmissionDecisionReasonInput = z.infer<typeof admissionDecisionReasonSchema>
export type AdmissionDocumentReviewInput = z.infer<typeof admissionDocumentReviewSchema>
export type AdmissionAssignmentInput = z.infer<typeof admissionAssignmentSchema>
export type AdmissionCommentCreateInput = z.infer<typeof admissionCommentCreateSchema>
export type StudentGuardianLinkInput = z.infer<typeof studentGuardianLinkSchema>
export type EnrollmentNoveltyCreateInput = z.infer<typeof enrollmentNoveltyCreateSchema>
export type EnrollmentUpdateInput = z.infer<typeof enrollmentUpdateSchema>

export type LoginInput = z.infer<typeof loginSchema>
export type StudentInput = z.infer<typeof studentSchema>
export type GuardianInput = z.infer<typeof guardianSchema>
export type StudentFiltersInput = z.infer<typeof studentFiltersSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
export type AcademicYearInput = z.infer<typeof academicYearSchema>
export type AcademicPeriodInput = z.infer<typeof academicPeriodSchema>
export type AcademicGradeInput = z.infer<typeof academicGradeSchema>
export type CourseInput = z.infer<typeof courseSchema>
export type PublicAdmissionSubmissionInput = z.infer<typeof publicAdmissionSubmissionSchema>
export type EnrollmentFormEditorInput = z.infer<typeof enrollmentFormEditorSchema>
export type AdmissionProcessInput = z.infer<typeof admissionProcessSchema>
export type ManualAdmissionInput = z.infer<typeof manualAdmissionSchema>
export type AdmissionUpdateInput = z.infer<typeof admissionUpdateSchema>
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

// ─── Communication templates & enrollment document acceptance ────────

export const communicationTemplateSchema = z.object({
  code: z.string().min(2).max(60),
  name: z.string().min(3).max(160),
  channel: z.enum(['email', 'sms', 'whatsapp', 'push', 'in_app']).default('email'),
  subject: z.string().max(200).optional().or(z.literal('')).or(z.null()),
  body: z.string().min(10).max(10000),
  variables: z.array(z.string().min(1).max(60)).default([]),
  isActive: z.boolean().default(true).optional(),
})

export const sendCommunicationSchema = z.object({
  templateCode: z.string().min(2).max(60),
  recipient: z.string().min(3).max(160),
  recipientName: z.string().min(2).max(160).optional().or(z.literal('')).or(z.null()),
  subject: z.string().max(200).optional().or(z.literal('')).or(z.null()),
  channel: z.enum(['email', 'sms', 'whatsapp', 'push', 'in_app']).default('email'),
  variables: z.record(z.string(), z.string()).default({}),
  admissionApplicationId: z.uuid().optional().or(z.literal('')).or(z.null()),
  enrollmentId: z.uuid().optional().or(z.literal('')).or(z.null()),
  entity: z.string().max(80).optional().or(z.literal('')).or(z.null()),
  entityId: z.uuid().optional().or(z.literal('')).or(z.null()),
  isInternal: z.boolean().default(false).optional(),
})

export const enrollmentDocumentAcceptanceSchema = z.object({
  enrollmentId: z.uuid(),
  documentCode: z.string().min(2).max(60),
  documentName: z.string().min(3).max(160),
  documentVersion: z.string().min(1).max(40),
  textSnapshot: z.string().min(10).max(20000),
  acceptedByName: z.string().min(2).max(160),
  acceptedByRelationship: z.string().min(2).max(40).optional().or(z.literal('')).or(z.null()),
  channel: z.enum(['admin_panel', 'public_form', 'in_person']).default('admin_panel'),
  notes: z.string().max(1000).optional().or(z.literal('')).or(z.null()),
})

// ─── Colombia catalogs, official reports, sensitive data ─────────────

export const daneCodeSchema = z.object({
  codeType: z.enum(['department', 'municipality', 'institution', 'branch', 'zone', 'sector', 'calendar']),
  code: z.string().min(1).max(30),
  name: z.string().min(2).max(160),
  parentCode: z.string().max(30).optional().or(z.literal('')).or(z.null()),
  isActive: z.boolean().default(true).optional(),
})

export const documentTypeCatalogSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(80),
  country: z.string().max(5).default('CO'),
  isNational: z.boolean().default(true).optional(),
  isActive: z.boolean().default(true).optional(),
  sortOrder: z.coerce.number().int().default(0).optional(),
})

export const officialReportSchema = z.object({
  reportType: z.enum(['simat', 'sineb', 'c600', 'siuce', 'matricula', 'novedades', 'other']),
  academicYearId: z.uuid(),
  reportDate: z.string().date().optional(),
  responsibleName: z.string().min(2).max(160),
  fileName: z.string().max(255).optional().or(z.literal('')).or(z.null()),
  fileKey: z.string().optional().or(z.literal('')).or(z.null()),
  notes: z.string().max(2000).optional().or(z.literal('')).or(z.null()),
  status: z.enum(['draft', 'submitted', 'acknowledged']).default('draft'),
})

export const studentSensitiveDataSchema = z.object({
  medicalConditions: z.string().max(2000).optional().or(z.literal('')).or(z.null()),
  disabilityInfo: z.string().max(2000).optional().or(z.literal('')).or(z.null()),
  reasonableAdjustments: z.string().max(2000).optional().or(z.literal('')).or(z.null()),
  daneInstitutionCode: z.string().max(30).optional().or(z.literal('')).or(z.null()),
  daneBranchCode: z.string().max(30).optional().or(z.literal('')).or(z.null()),
  calendar: z.enum(['A', 'B', 'other']).optional().or(z.literal('')).or(z.null()),
  zone: z.enum(['urban', 'rural']).optional().or(z.literal('')).or(z.null()),
  sector: z.enum(['private', 'official']).optional().or(z.literal('')).or(z.null()),
  originInstitution: z.string().max(200).optional().or(z.literal('')).or(z.null()),
  originGrade: z.string().max(80).optional().or(z.literal('')).or(z.null()),
})

export const studentEmergencyContactSchema = z.object({
  name: z.string().min(2).max(160),
  phone: z.string().min(7).max(30),
  relationship: z.string().min(2).max(40),
  isAuthorizedToPickup: z.boolean().default(true),
})

export type DaneCodeInput = z.infer<typeof daneCodeSchema>
export type DocumentTypeCatalogInput = z.infer<typeof documentTypeCatalogSchema>
export type OfficialReportInput = z.infer<typeof officialReportSchema>
export type StudentSensitiveDataInput = z.infer<typeof studentSensitiveDataSchema>

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

export type CommunicationTemplateInput = z.infer<typeof communicationTemplateSchema>
export type EnrollmentDocumentAcceptanceInput = z.infer<typeof enrollmentDocumentAcceptanceSchema>
export type SendCommunicationInput = z.infer<typeof sendCommunicationSchema>

export const committeeTypeSchema = z.enum([
  'evaluation',
  'promotion',
])

export const committeeMeetingCreateSchema = z.object({
  academicYearId: z.uuid(),
  committeeType: committeeTypeSchema,
  meetingDate: z.string().date(),
  title: z.string().min(3).max(200),
  objective: z.string().max(4000).optional().or(z.literal('')).or(z.null()),
  callTo: z.string().max(2000).optional().or(z.literal('')).or(z.null()),
  attendees: z.array(z.object({
    userId: z.uuid().optional().or(z.literal('')).or(z.null()),
    fullName: z.string().min(2).max(160),
    role: z.string().min(2).max(80),
  })).default([]),
})

export const committeeMeetingUpdateSchema = z.object({
  development: z.string().max(10000).optional().or(z.literal('')).or(z.null()),
  conclusions: z.string().max(5000).optional().or(z.literal('')).or(z.null()),
  status: z.enum(['draft', 'approved']).optional(),
})

export const committeeDecisionCreateSchema = z.object({
  studentId: z.uuid().optional().or(z.literal('')).or(z.null()),
  enrollmentId: z.uuid().optional().or(z.literal('')).or(z.null()),
  decisionType: z.string().min(2).max(40),
  description: z.string().min(3).max(2000),
  decision: z.string().min(2).max(30),
  justification: z.string().max(4000).optional().or(z.literal('')).or(z.null()),
  resultScore: z.coerce.number().min(0).max(10).optional().or(z.null()),
})

export type CommitteeMeetingCreateInput = z.infer<typeof committeeMeetingCreateSchema>
export type CommitteeMeetingUpdateInput = z.infer<typeof committeeMeetingUpdateSchema>
export type CommitteeDecisionCreateInput = z.infer<typeof committeeDecisionCreateSchema>

export const coexistenceClassificationSchema = z.enum(['tipo_i', 'tipo_ii', 'tipo_iii'])

export const coexistenceCaseCreateSchema = z.object({
  academicYearId: z.uuid(),
  studentId: z.uuid(),
  reporterName: z.string().max(160).optional().or(z.literal('')).or(z.null()),
  incidentDate: z.string().date(),
  classification: coexistenceClassificationSchema,
  category: z.string().min(2).max(100),
  description: z.string().min(10).max(5000),
  evidence: z.string().max(5000).optional().or(z.literal('')).or(z.null()),
  immediateActions: z.string().max(3000).optional().or(z.literal('')).or(z.null()),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  assignedTo: z.uuid().optional().or(z.literal('')).or(z.null()),
  isConfidential: z.boolean().default(false),
  involvedPersons: z.array(z.object({
    studentId: z.uuid().optional().or(z.literal('')).or(z.null()),
    personName: z.string().min(2).max(160),
    role: z.enum(['aggressor', 'victim', 'witness', 'other']),
    notes: z.string().max(1000).optional().or(z.literal('')).or(z.null()),
  })).default([]),
})

export const coexistenceCaseUpdateSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assignedTo: z.uuid().nullable().optional(),
  resolutionNotes: z.string().max(5000).optional().or(z.literal('')).or(z.null()),
  evidence: z.string().max(5000).optional().or(z.literal('')).or(z.null()),
  immediateActions: z.string().max(3000).optional().or(z.literal('')).or(z.null()),
})

export const coexistenceInterventionCreateSchema = z.object({
  interventionType: z.string().min(2).max(60),
  description: z.string().min(5).max(5000),
  performedByName: z.string().max(160).optional().or(z.literal('')).or(z.null()),
  interventionDate: z.string().date(),
  followUpDate: z.string().date().optional().or(z.literal('')).or(z.null()),
  outcome: z.string().max(3000).optional().or(z.literal('')).or(z.null()),
  status: z.enum(['completed', 'pending', 'follow_up']).default('completed'),
})

export type CoexistenceCaseCreateInput = z.infer<typeof coexistenceCaseCreateSchema>
export type CoexistenceCaseUpdateInput = z.infer<typeof coexistenceCaseUpdateSchema>
export type CoexistenceInterventionCreateInput = z.infer<typeof coexistenceInterventionCreateSchema>

export const piarRecordCreateSchema = z.object({
  academicYearId: z.uuid(),
  studentId: z.uuid(),
  enrollmentId: z.uuid().optional().or(z.literal('')).or(z.null()),
  diagnosticInfo: z.string().max(5000).optional().or(z.literal('')).or(z.null()),
  healthConditions: z.string().max(5000).optional().or(z.literal('')).or(z.null()),
  disabilityType: z.string().max(100).optional().or(z.literal('')).or(z.null()),
  disabilityCategory: z.string().max(60).optional().or(z.literal('')).or(z.null()),
  hasPIAR: z.boolean().default(true),
  approvalDate: z.string().date().optional().or(z.literal('')).or(z.null()),
})

export const piarRecordUpdateSchema = z.object({
  status: z.enum(['active', 'inactive', 'completed']).optional(),
  diagnosticInfo: z.string().max(5000).optional().or(z.literal('')).or(z.null()),
  healthConditions: z.string().max(5000).optional().or(z.literal('')).or(z.null()),
  disabilityType: z.string().max(100).optional().or(z.literal('')).or(z.null()),
  disabilityCategory: z.string().max(60).optional().or(z.literal('')).or(z.null()),
  hasPIAR: z.boolean().optional(),
  approvalDate: z.string().date().optional().or(z.literal('')).or(z.null()),
})

export const piarAdjustmentCreateSchema = z.object({
  subjectId: z.uuid().optional().or(z.literal('')).or(z.null()),
  adjustmentType: z.string().min(2).max(60),
  description: z.string().min(5).max(5000),
  responsibleName: z.string().max(160).optional().or(z.literal('')).or(z.null()),
  startDate: z.string().date().optional().or(z.literal('')).or(z.null()),
  endDate: z.string().date().optional().or(z.literal('')).or(z.null()),
  evaluationCriteria: z.string().max(3000).optional().or(z.literal('')).or(z.null()),
})

export const piarFollowUpCreateSchema = z.object({
  followUpDate: z.string().date(),
  periodId: z.uuid().optional().or(z.literal('')).or(z.null()),
  progress: z.string().min(5).max(5000),
  difficulties: z.string().max(3000).optional().or(z.literal('')).or(z.null()),
  adjustmentsStatus: z.enum(['ongoing', 'effective', 'ineffective', 'modified']).default('ongoing'),
  recommendations: z.string().max(3000).optional().or(z.literal('')).or(z.null()),
  performedByName: z.string().max(160).optional().or(z.literal('')).or(z.null()),
  agreementsWithFamily: z.string().max(3000).optional().or(z.literal('')).or(z.null()),
})

export const piarAnnualReportSchema = z.object({
  reportYear: z.coerce.number().int().min(2000).max(2100),
  competenciesSummary: z.string().max(10000).optional().or(z.literal('')).or(z.null()),
  progressDescription: z.string().max(10000).optional().or(z.literal('')).or(z.null()),
  transitionRecommendations: z.string().max(5000).optional().or(z.literal('')).or(z.null()),
  nextGradeId: z.uuid().optional().or(z.literal('')).or(z.null()),
  nextAcademicYearId: z.uuid().optional().or(z.literal('')).or(z.null()),
  status: z.enum(['draft', 'submitted']).default('draft'),
})

export type PiarRecordCreateInput = z.infer<typeof piarRecordCreateSchema>
export type PiarRecordUpdateInput = z.infer<typeof piarRecordUpdateSchema>
export type PiarAdjustmentCreateInput = z.infer<typeof piarAdjustmentCreateSchema>
export type PiarFollowUpCreateInput = z.infer<typeof piarFollowUpCreateSchema>
export type PiarAnnualReportInput = z.infer<typeof piarAnnualReportSchema>

export const feeResolutionCreateSchema = z.object({
  academicYearId: z.uuid(),
  resolutionNumber: z.string().min(2).max(60),
  resolutionDate: z.string().date(),
  issuingEntity: z.string().max(120).default('Secretaría de Educación'),
  annualFee: z.coerce.number().positive(),
  registrationFeePercentage: z.coerce.number().min(0).max(100).default(10),
  maxInstallments: z.coerce.number().int().min(1).max(12).default(10),
  notes: z.string().max(2000).optional().or(z.literal('')).or(z.null()),
})

export const feeItemCreateSchema = z.object({
  feeResolutionId: z.uuid(),
  itemType: z.enum(['matricula', 'pension', 'transporte', 'alimentacion', 'seguro', 'materiales', 'otros']),
  name: z.string().min(2).max(160),
  amount: z.coerce.number().positive(),
  dueDay: z.coerce.number().int().min(1).max(31).default(5),
  frequency: z.enum(['monthly', 'yearly', 'biannual', 'quarterly', 'one_time']).default('monthly'),
  isMandatory: z.boolean().default(true),
  description: z.string().max(1000).optional().or(z.literal('')).or(z.null()),
})

export const studentFeeAssignmentSchema = z.object({
  enrollmentId: z.uuid(),
  feeItemId: z.uuid(),
  customAmount: z.coerce.number().positive().optional().or(z.null()),
  discountPercentage: z.coerce.number().min(0).max(100).optional().or(z.null()),
  discountReason: z.string().max(200).optional().or(z.literal('')).or(z.null()),
  isExempt: z.boolean().default(false),
})

export const paymentAgreementCreateSchema = z.object({
  enrollmentId: z.uuid(),
  agreementNumber: z.string().min(2).max(60),
  startDate: z.string().date(),
  endDate: z.string().date(),
  totalAmount: z.coerce.number().positive(),
  installmentCount: z.coerce.number().int().min(1).max(36).default(1),
  installmentAmount: z.coerce.number().positive(),
  notes: z.string().max(2000).optional().or(z.literal('')).or(z.null()),
})

export const financialClearanceSchema = z.object({
  enrollmentId: z.uuid(),
  isCleared: z.boolean(),
  clearanceType: z.enum(['annual', 'partial', 'graduation']).default('annual'),
  observations: z.string().max(2000).optional().or(z.literal('')).or(z.null()),
  pendingAmount: z.coerce.number().min(0).default(0),
})

export type FeeResolutionCreateInput = z.infer<typeof feeResolutionCreateSchema>
export type FeeItemCreateInput = z.infer<typeof feeItemCreateSchema>
export type StudentFeeAssignmentInput = z.infer<typeof studentFeeAssignmentSchema>
export type PaymentAgreementCreateInput = z.infer<typeof paymentAgreementCreateSchema>
export type FinancialClearanceInput = z.infer<typeof financialClearanceSchema>

export const officialDocumentTypeSchema = z.enum([
  'study_certificate',
  'enrollment_certificate',
  'grade_certificate',
  'grade_book',
  'coexistence_record',
])

export const officialDocumentRequestSchema = z.object({
  documentType: officialDocumentTypeSchema,
  academicYearId: z.uuid(),
  studentId: z.uuid(),
  enrollmentId: z.uuid().optional().or(z.literal('')).or(z.null()),
  includeAcademicHistory: z.boolean().default(true),
  includeAttendanceSummary: z.boolean().default(false),
  purpose: z.string().max(500).optional().or(z.literal('')).or(z.null()),
})

export const documentVerificationSchema = z.object({
  verificationCode: z.string().min(10).max(40),
})

export type OfficialDocumentRequestInput = z.infer<typeof officialDocumentRequestSchema>

export const officialReportGenerateSchema = z.object({
  reportType: z.enum(['simat_enrollment', 'c600_base', 'sineb_base', 'custom']),
  academicYearId: z.uuid(),
  branchId: z.uuid().optional().or(z.literal('')).or(z.null()),
  gradeId: z.uuid().optional().or(z.literal('')).or(z.null()),
  format: z.enum(['csv', 'json']).default('csv'),
})

export type OfficialReportGenerateInput = z.infer<typeof officialReportGenerateSchema>

export const notificationTriggerSchema = z.object({
  code: z.string().min(2).max(60),
  name: z.string().min(3).max(160),
  eventType: z.string().min(2).max(60),
  templateCode: z.string().max(80).optional().or(z.literal('')).or(z.null()),
  channel: z.enum(['email', 'sms', 'push', 'in_app']).default('email'),
  recipients: z.enum(['family', 'student', 'teacher', 'admin', 'all']).default('family'),
  isAutomatic: z.boolean().default(true),
  isActive: z.boolean().default(true),
  conditions: z.record(z.string(), z.unknown()).default({}),
  delayMinutes: z.coerce.number().int().min(0).max(1440).default(0),
})

export const autoAlertSchema = z.object({
  academicYearId: z.uuid().optional().or(z.literal('')).or(z.null()),
  alertType: z.string().min(2).max(60),
  name: z.string().min(3).max(160),
  entityType: z.string().min(2).max(40),
  dueDaysBefore: z.coerce.number().int().min(0).max(90).default(7),
  isActive: z.boolean().default(true),
})

export type NotificationTriggerInput = z.infer<typeof notificationTriggerSchema>
export type AutoAlertInput = z.infer<typeof autoAlertSchema>
