export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
  meta?: Record<string, unknown>
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface SessionUser {
  id: string
  tenantId: string
  email: string
  fullName: string
  roleCodes: string[]
  permissions: string[]
}

export interface NavigationItemDto {
  id: string
  code: string
  label: string
  to: string
  shortLabel: string
  badge: number | null
  mobileVisible: boolean
}

export interface NavigationSectionDto {
  id: string
  code: string
  title: string
  items: NavigationItemDto[]
}

export interface NavigationMenuDto {
  sections: NavigationSectionDto[]
  mobileItems: NavigationItemDto[]
}

export interface NavigationAdminItemDto {
  id: string
  sectionId: string
  code: string
  label: string
  to: string
  shortLabel: string
  badge: number | null
  sortOrder: number
  requiredPermission: string | null
  mobileVisible: boolean
  isActive: boolean
  roleCodes: string[]
}

export interface NavigationAdminSectionDto {
  id: string
  code: string
  title: string
  sortOrder: number
  isActive: boolean
  items: NavigationAdminItemDto[]
}

export interface NavigationAdminDto {
  sections: NavigationAdminSectionDto[]
  roles: RoleOptionDto[]
}

export interface StudentDto {
  id: string
  tenantId: string
  firstName: string
  middleName: string | null
  lastName: string
  documentType: string
  documentNumber: string
  birthDate: string | null
  gender: string | null
  bloodType: string | null
  status: string
  academicYearName?: string | null
  gradeName?: string | null
  groupName?: string | null
  createdAt: string
  updatedAt: string
}

export interface AcademicYearDto {
  id: string
  tenantId: string
  name: string
  year: number
  startsOn: string
  endsOn: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface AcademicPeriodDto {
  id: string
  tenantId: string
  academicYearId: string
  academicYearName: string
  name: string
  code: string
  startsOn: string
  endsOn: string
  weight: number
  status: string
  createdAt: string
  updatedAt: string
}

export interface AcademicPeriodStatusChangeResultDto {
  id: string
  status: string
  summary: {
    enrollments: number
    gradeRecords: number
    attendanceRecords: number
    evaluationActivities: number
    activityScores: number
    observations: number
    supportStrategies: number
  }
  recalculatedGradeRecords: number
}

export interface AcademicGradeDto {
  id: string
  tenantId: string
  name: string
  level: number
  levelName: string | null
  orderNumber: number | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface AcademicYearLevelDto {
  id: string
  tenantId: string
  academicYearId: string
  academicYearName: string
  journeyId: string | null
  journeyName: string | null
  levelCode: string
  name: string
  orderNumber: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CourseDto {
  id: string
  tenantId: string
  academicYearId: string
  academicYearName: string
  gradeId: string
  gradeName: string
  branchId: string | null
  branchName: string | null
  name: string
  capacity: number
  status: string
  inheritedStartsOn: string | null
  inheritedEndsOn: string | null
  createdAt: string
  updatedAt: string
}

export interface AdmissionProcessDto {
  year: number
  academicYearId: string
  academicYearName: string
  tenantSlug: string
  name: string
  startsOn: string
  endsOn: string
  publicStatus: string
  publicLink: string
}

export interface AdmissionOverviewDto {
  year: number
  academicYearId: string
  checklist: Array<{
    code: string
    label: string
    ready: boolean
    detail: string
  }>
  readyToOpen: boolean
  funnel: {
    total: number
    draft: number
    submitted: number
    reviewing: number
    accepted: number
    converted: number
    rejected: number
  }
}

export interface AdmissionApplicationDto {
  id: string
  studentId: string
  studentName: string
  studentDocument: string
  guardianName: string
  guardianEmail: string | null
  requestedGradeId: string
  requestedGradeName: string
  requestedGroupId: string | null
  requestedGroupName: string | null
  academicYearId: string
  academicYearName: string
  status: string
  source: string
  progress: number
  applicationDate: string
  submittedAt: string | null
  convertedEnrollmentId: string | null
}

export interface AdmissionStatusChangeResultDto {
  id: string
  status: string
  reviewedAt: string | null
  acceptedAt: string | null
  rejectedAt: string | null
  notes: string | null
}

export interface AdmissionFieldValueDto {
  fieldCode: string
  fieldLabel: string
  fieldType: string
  displayValue: string
  rawValue: unknown
}

export interface AdmissionSectionDetailDto {
  title: string
  fields: AdmissionFieldValueDto[]
}

export interface AdmissionDocumentDto {
  id: string
  documentCode: string
  name: string
  fileName: string
  mimeType: string | null
  fileSizeBytes: number | null
  status: string
  source: 'metadata' | 'uploaded'
}

export interface AdmissionApplicationDetailDto {
  application: AdmissionApplicationDto & {
    notes: string | null
    fixedData: Record<string, unknown>
  }
  student: {
    id: string
    firstName: string
    middleName: string | null
    lastName: string
    documentType: string
    documentNumber: string
    birthDate: string | null
    gender: string | null
    bloodType: string | null
    status: string
  }
  guardian: {
    id: string
    firstName: string
    lastName: string
    documentType: string
    documentNumber: string
    phone: string | null
    email: string | null
    relationship: string | null
  } | null
  submission: {
    id: string
    status: string
    progressPercent: number
    submittedAt: string | null
  } | null
  sections: AdmissionSectionDetailDto[]
  documents: AdmissionDocumentDto[]
}

export interface StudentAdmissionProfileDto {
  admission: AdmissionApplicationDetailDto | null
}

export interface EnrollmentDto {
  id: string
  studentId: string
  studentName: string
  studentDocument: string
  academicYearId: string
  academicYearName: string
  gradeId: string
  gradeName: string
  groupId: string | null
  groupName: string | null
  enrollmentType: string
  enrollmentStatus: string
  enrollmentDate: string
  admissionApplicationId: string | null
  previousEnrollmentId?: string | null
  promotionStatus?: string | null
}

export interface EnrollmentCandidateDto {
  studentId: string
  studentName: string
  studentDocument: string
  latestEnrollment: {
    id: string
    academicYearId: string
    academicYearName: string
    year: number
    gradeId: string
    gradeName: string
    groupId: string | null
    groupName: string | null
    enrollmentType: string
    enrollmentStatus: string
    enrollmentDate: string
  } | null
  recommendedEnrollmentType: 'renewal' | 'promotion' | 'transfer' | 'new'
}

export interface EnrollmentContinuityPreviewItemDto {
  studentId: string
  studentName: string
  studentDocument: string
  previousEnrollmentId: string
  previousAcademicYearName: string
  previousGradeId: string
  previousGradeName: string
  previousGroupId: string | null
  previousGroupName: string | null
  suggestedGradeId: string | null
  suggestedGradeName: string | null
  suggestedEnrollmentType: 'renewal' | 'promotion' | 'auto_promotion'
  suggestedGroupOptions: Array<{
    id: string
    name: string
    gradeId: string
    capacity: number
    occupiedCount: number
    availableSeats: number
  }>
  academicSummary: {
    annualAverage: number | null
    passingSubjects: number
    failedSubjects: number
    pendingSupportStrategies: number
    failedSubjectNames: string[]
    passingValue: number
  }
  issues: string[]
  eligible: boolean
}

export interface EnrollmentContinuityPreviewDto {
  targetAcademicYearId: string
  targetAcademicYearName: string
  sourceAcademicYearId: string
  sourceAcademicYearName: string
  mode: 'renewal' | 'promotion' | 'auto_promotion'
  totalCandidates: number
  eligibleCandidates: number
  blockedCandidates: number
  items: EnrollmentContinuityPreviewItemDto[]
}

export interface EnrollmentBatchCreateResultDto {
  createdCount: number
  skippedCount: number
  createdIds: string[]
  skipped: Array<{
    studentId: string
    reason: string
  }>
}

export interface AnnualPromotionPreviewItemDto {
  enrollmentId: string
  studentId: string
  studentName: string
  studentDocument: string
  gradeId: string
  gradeName: string
  groupId: string | null
  groupName: string | null
  currentPromotionStatus: 'pending' | 'promoted' | 'not_promoted' | 'conditional' | null
  suggestedPromotionStatus: 'pending' | 'promoted' | 'not_promoted' | 'conditional'
  academicSummary: {
    annualAverage: number | null
    passingSubjects: number
    failedSubjects: number
    pendingSupportStrategies: number
    failedSubjectNames: string[]
    passingValue: number
  }
  issues: string[]
}

export interface AnnualPromotionPreviewDto {
  academicYearId: string
  academicYearName: string
  totalStudents: number
  promotedCount: number
  conditionalCount: number
  notPromotedCount: number
  pendingCount: number
  items: AnnualPromotionPreviewItemDto[]
}

export interface AnnualPromotionDecisionResultDto {
  updatedCount: number
  items: Array<{
    enrollmentId: string
    promotionStatus: 'pending' | 'promoted' | 'not_promoted' | 'conditional'
  }>
}

export interface SubjectDto {
  id: string
  tenantId: string
  academicAreaId: string | null
  academicAreaName: string | null
  name: string
  code: string
  area: string | null
  createdAt: string
  updatedAt: string
}

export interface GradeSubjectDto {
  id: string
  tenantId: string
  academicYearId: string
  academicYearName: string
  gradeId: string
  gradeName: string
  subjectId: string
  subjectName: string
  weeklyHours: number
  createdAt: string
  updatedAt: string
}

export interface CompetencyDto {
  id: string
  tenantId: string
  academicAreaId: string
  academicAreaName?: string
  subjectId?: string | null
  subjectName?: string | null
  gradeId?: string | null
  gradeName?: string | null
  name: string
  description?: string | null
  isActive: boolean
  orderNumber: number
  createdAt: string
  updatedAt: string
}

export interface AchievementIndicatorDto {
  id: string
  tenantId: string
  achievementId: string
  description: string
  orderNumber: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface LearningAchievementDto {
  id: string
  tenantId: string
  academicYearId: string
  academicYearName: string
  academicPeriodId: string
  academicPeriodName: string
  gradeId: string
  gradeName: string
  subjectId: string
  subjectName: string
  code: string
  title: string
  description: string
  weight: number
  competencyId?: string | null
  competencyName?: string | null
  orderNumber?: number
  expectedPerformance?: string | null
  indicators?: AchievementIndicatorDto[]
  createdAt: string
  updatedAt: string
}

export interface GradebookEntryDto {
  studentId: string
  studentName: string
  studentDocument: string
  enrollmentId: string
  groupId: string
  groupName: string
  gradeRecordId: string | null
  subjectId: string
  subjectName: string
  academicPeriodId: string
  academicPeriodName: string
  score: number | null
  gradeValue: string | null
  gradeValueType: string | null
  maxScore: number
  notes: string | null
}

export interface AppliedGradingScaleDto {
  id: string
  name: string
  minValue: number
  maxValue: number
  passingValue: number
  decimalPlaces: number
  scaleType: string
  ranges: Array<{
    nationalLevel: string
    institutionalLabel: string
    minScore: number
    maxScore: number
    isPassing: boolean
    color: string | null
  }>
}

export interface GradebookResponseDto {
  items: GradebookEntryDto[]
  scale: AppliedGradingScaleDto
}

export interface AttendanceEntryDto {
  recordId: string | null
  studentId: string
  studentName: string
  studentDocument: string
  groupId: string
  groupName: string
  subjectId: string
  subjectName: string
  academicYearId: string
  academicPeriodId: string
  attendanceDate: string
  status: 'present' | 'absent' | 'late' | 'excused'
  justified: boolean
  notes: string | null
}

// ─── SIEE Phase 1 DTOs ────────────────────────────────────────────

export interface AcademicAreaDto {
  id: string
  tenantId: string
  name: string
  code: string
  description: string | null
  color: string | null
  orderNumber: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface GradingScaleDto {
  id: string
  tenantId: string
  name: string
  minValue: string
  maxValue: string
  passingValue: string
  decimalPlaces: number
  scaleType: string
  isActive: boolean
  ranges?: PerformanceRangeDto[]
  createdAt: string
  updatedAt: string
}

export interface PerformanceRangeDto {
  id: string
  tenantId: string
  gradingScaleId: string
  nationalLevel: string
  institutionalLabel: string
  minScore: string
  maxScore: string
  isPassing: boolean
  color: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

// ─── SIEE Phase 3 DTOs ────────────────────────────────────────────

export interface EvaluationActivityDto {
  id: string
  tenantId: string
  academicYearId: string
  academicPeriodId: string
  groupId: string
  groupName?: string
  subjectId: string
  subjectName?: string
  achievementId: string
  achievementCode?: string
  achievementTitle?: string
  teacherId?: string | null
  teacherName?: string | null
  name: string
  description?: string | null
  activityType: string
  weightPercentage: number
  maxScore: number
  dueDate?: string | null
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

export interface ActivityScoreDto {
  id: string
  tenantId: string
  activityId: string
  studentId: string
  studentName?: string
  studentDocument?: string
  score: number
  gradeValue?: string | null
  performanceLevel?: string | null
  observations?: string | null
  submittedAt?: string | null
  gradedAt?: string | null
  gradedBy?: string | null
  createdAt: string
  updatedAt: string
}

export interface ActivityScoresResponseDto {
  items: ActivityScoreDto[]
  scale: AppliedGradingScaleDto | null
}

export interface AcademicObservationDto {
  id: string
  tenantId: string
  academicYearId: string
  academicPeriodId: string
  studentId: string
  studentName?: string
  subjectId: string
  subjectName?: string
  achievementId?: string | null
  achievementCode?: string | null
  observationType: string
  text: string
  createdAt: string
  updatedAt: string
}

export interface ObservationBankDto {
  id: string
  tenantId: string
  subjectId?: string | null
  subjectName?: string | null
  gradeId?: string | null
  gradeName?: string | null
  performanceLevel?: string | null
  observationType: string
  text: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface SupportStrategyDto {
  id: string
  tenantId: string
  academicYearId: string
  academicPeriodId: string
  studentId: string
  studentName?: string
  subjectId: string
  subjectName?: string
  achievementId?: string | null
  achievementCode?: string | null
  teacherId?: string | null
  teacherName?: string | null
  description: string
  dueDate?: string | null
  status: string
  resultScore?: number | null
  createdAt: string
  updatedAt: string
}

export interface ReportCardSubjectObservationDto {
  id: string
  type: string
  text: string
}

export interface ReportCardSubjectSupportStrategyDto {
  id: string
  achievementCode?: string | null
  description: string
  dueDate?: string | null
  status: string
  resultScore?: number | null
}

export interface ReportCardSubjectDto {
  subjectId: string
  subjectName: string
  academicAreaName?: string | null
  teacherName?: string | null
  score?: number | null
  gradeValue?: string | null
  gradeValueType?: string | null
  maxScore?: number | null
  performanceLevel?: string | null
  institutionalLabel?: string | null
  isPassing?: boolean | null
  notes?: string | null
  attendance: {
    absent: number
    late: number
    excused: number
    present: number
  }
  observations: ReportCardSubjectObservationDto[]
  supportStrategies: ReportCardSubjectSupportStrategyDto[]
}

export interface StudentReportCardDto {
  generatedAt: string
  student: {
    id: string
    fullName: string
    document: string
  }
  academicYear: {
    id: string
    name: string
  }
  academicPeriod: {
    id: string
    name: string
    weight: number
    status: string
  }
  enrollment: {
    id: string
    gradeName: string
    groupName?: string | null
  }
  scale: {
    id: string
    name: string
    minValue: number
    passingValue: number
    maxValue: number
    decimalPlaces: number
    scaleType: string
  }
  groupDirector?: string | null
  summary: {
    subjectsWithGrades: number
    totalSubjects: number
    averageScore?: number | null
    attendance: {
      absent: number
      late: number
      excused: number
      present: number
    }
    pendingSupportStrategies: number
  }
  subjects: ReportCardSubjectDto[]
}

export interface AnnualStudentReportCardDto {
  generatedAt: string
  student: {
    id: string
    fullName: string
    document: string
  }
  academicYear: {
    id: string
    name: string
  }
  enrollment: {
    id: string
    gradeName: string
    groupName?: string | null
    promotionStatus?: string | null
  }
  scale: {
    id: string
    name: string
    minValue: number
    passingValue: number
    maxValue: number
    decimalPlaces: number
    scaleType: string
  }
  groupDirector?: string | null
  summary: {
    subjectsWithScores: number
    totalSubjects: number
    annualAverage?: number | null
    failedSubjects: number
    pendingSupportStrategies: number
    attendance: {
      absent: number
      late: number
      excused: number
      present: number
    }
  }
  subjects: Array<{
    subjectId: string
    subjectName: string
    academicAreaName?: string | null
    teacherName?: string | null
    annualScore?: number | null
    annualGradeValue?: string | null
    gradeValueType?: string | null
    performanceLevel?: string | null
    institutionalLabel?: string | null
    isPassing?: boolean | null
    periodScores: Array<{
      academicPeriodId: string
      academicPeriodName: string
      weight: number
      score?: number | null
    }>
    attendance: {
      absent: number
      late: number
      excused: number
      present: number
    }
    observations: ReportCardSubjectObservationDto[]
    supportStrategies: ReportCardSubjectSupportStrategyDto[]
  }>
}

export interface TeacherDto {
  id: string
  tenantId: string
  userId: string | null
  fullName: string
  email: string | null
  phone: string | null
  specialty: string | null
  status: string
  maxWeeklyHours: number
  createdAt: string
  updatedAt: string
}

export interface CourseSubjectDto {
  id: string
  tenantId: string
  academicYearId: string
  academicYearName?: string
  groupId: string
  groupName?: string
  gradeName?: string
  subjectId: string
  subjectName?: string
  weeklyHours: number
  teacherId: string | null
  teacherName?: string | null
  createdAt: string
  updatedAt: string
}

export interface TeacherResponsibilityDto {
  id: string
  tenantId: string
  academicYearId: string
  academicYearName?: string
  teacherId: string
  teacherName?: string
  responsibilityType: 'group_director' | 'coordinator'
  scopeType: 'global' | 'branch' | 'level' | 'grade' | 'group'
  branchId?: string | null
  levelName?: string | null
  gradeId?: string | null
  groupId?: string | null
  groupName?: string | null
  gradeName?: string | null
  title?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface GradingScaleAssignmentDto {
  id: string
  tenantId: string
  academicYearId: string
  academicYearName?: string
  gradingScaleId: string
  gradingScaleName?: string
  scopeType: 'level' | 'grade'
  levelName?: string | null
  gradeId?: string | null
  gradeName?: string | null
  title?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AcademicYearJourneyDto {
  id: string
  tenantId: string
  academicYearId: string
  academicYearName?: string
  branchId: string | null
  branchName?: string | null
  targetLevelName: string | null
  targetGradeId: string | null
  targetGradeName?: string | null
  name: string
  code: string
  startsAt: string
  endsAt: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AcademicYearJourneySlotDto {
  id: string
  tenantId: string
  journeyId: string
  journeyName?: string
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'
  slotOrder: number
  startsAt: string
  endsAt: string
  slotType: 'class' | 'break' | 'homeroom' | 'lunch' | 'institutional'
  label: string | null
  createdAt: string
  updatedAt: string
}

export interface GroupJourneyOptionDto {
  id: string
  tenantId: string
  academicYearId: string
  academicYearName?: string
  groupId: string
  groupName?: string
  gradeName?: string
  journeyId: string
  journeyName?: string
  journeyCode?: string
  branchName?: string | null
  priority: number
  isPreferred: boolean
  createdAt: string
  updatedAt: string
}

export interface GroupTimetableEntryDto {
  id: string
  tenantId: string
  academicYearId: string
  groupId: string
  groupName?: string
  gradeName?: string
  journeyId: string
  journeyName?: string
  journeySlotId: string
  courseSubjectId: string | null
  subjectId: string
  subjectName?: string
  teacherId: string | null
  teacherName?: string | null
  branchName?: string | null
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'
  slotOrder: number
  startsAt?: string
  endsAt?: string
  entryType: 'class' | 'break' | 'institutional'
  status: 'draft' | 'published' | 'locked'
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface TimetableGenerationGroupSummaryDto {
  groupId: string
  groupName: string
  gradeName: string | null
  journeyId: string | null
  journeyName: string | null
  generatedEntries: number
  conflicts: string[]
}

export interface TimetableGenerationResultDto {
  academicYearId: string
  generatedGroups: number
  generatedEntries: number
  blockedGroups: string[]
  conflicts: string[]
  groups: TimetableGenerationGroupSummaryDto[]
}

export interface TimetableStatusChangeResultDto {
  academicYearId: string
  status: 'draft' | 'published' | 'locked'
  affectedEntries: number
}

export interface TeacherUserCandidateDto {
  id: string
  fullName: string
  email: string
  status: string
  roleCodes: string[]
  hasTeacherRole: boolean
  linkedTeacherId: string | null
}

export interface RoleOptionDto {
  id: string
  code: string
  name: string
  description: string | null
}

export interface UserManagementDto {
  id: string
  tenantId: string
  fullName: string
  email: string
  status: string
  roleCodes: string[]
  roleNames: string[]
  linkedTeacherId: string | null
  createdAt: string
  updatedAt: string
}
