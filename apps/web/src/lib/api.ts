import type {
  AcademicGradeDto,
  AcademicYearLevelDto,
  AcademicPeriodDto,
  AcademicPeriodStatusChangeResultDto,
  AcademicYearDto,
  AdmissionApplicationDto,
  AdmissionApplicationDetailDto,
  AdmissionActiveFormDto,
  AdmissionOverviewDto,
  AdmissionProcessDto,
  AdmissionStatusChangeResultDto,
  AnnualPromotionDecisionResultDto,
  AnnualPromotionPreviewDto,
  ApiResponse,
  CourseDto,
  EnrollmentBatchCreateResultDto,
  EnrollmentCandidateDto,
  EnrollmentContinuityPreviewDto,
  EnrollmentDto,
  GradebookEntryDto,
  GradebookResponseDto,
  AttendanceEntryDto,
  LearningAchievementDto,
  PaginatedResponse,
  StudentDto,
  SessionUser,
  StudentAdmissionProfileDto,
  SubjectDto,
  GradeSubjectDto,
  AcademicAreaDto,
  GradingScaleDto,
  GradingScaleAssignmentDto,
  PerformanceRangeDto,
  CompetencyDto,
  AchievementIndicatorDto,
  EvaluationActivityDto,
  ActivityScoreDto,
  ActivityScoresResponseDto,
  AcademicObservationDto,
  AnnualStudentReportCardDto,
  ObservationBankDto,
  SupportStrategyDto,
  StudentReportCardDto,
  TeacherDto,
  CourseSubjectDto,
  TeacherResponsibilityDto,
  AcademicYearJourneyDto,
  AcademicYearJourneySlotDto,
  GroupJourneyOptionDto,
  GroupTimetableEntryDto,
  TimetableGenerationResultDto,
  TimetableStatusChangeResultDto,
  TeacherUserCandidateDto,
  RoleOptionDto,
  UserManagementDto,
  NavigationMenuDto,
  NavigationAdminDto,
  CommitteeDto,
  CommitteeDetailDto,
  CoexistenceCaseDto,
  CoexistenceCaseDetailDto,
  PiarRecordDto,
  PiarRecordDetailDto,
} from '@ofir/shared'
import { beginAppActivity, endAppActivity } from '../stores/app-activity'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8787/api'
const DEFAULT_TENANT_ID = '11111111-1111-1111-1111-111111111111'

const withJsonHeader = (headers?: HeadersInit, body?: BodyInit | null) =>
  body instanceof FormData
    ? headers ?? {}
    : {
        'Content-Type': 'application/json',
        ...(headers ?? {}),
      }

const clearSessionAndRedirectToLogin = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('userName')

  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
}

const isAuthExpired = (status: number, message: string) =>
  status === 401 ||
  message.includes('JWTExpired') ||
  message.includes('"exp" claim timestamp check failed') ||
  message.toLowerCase().includes('sesion expirada') ||
  message.toLowerCase().includes('no autorizado')

const getHeaders = () => {
  const token = localStorage.getItem('token')

  return {
    'x-tenant-id': localStorage.getItem('tenantId') ?? DEFAULT_TENANT_ID,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  beginAppActivity()
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...getHeaders(),
        ...withJsonHeader(init?.headers, init?.body ?? null),
      },
    })

    const contentType = response.headers.get('content-type') ?? ''
    const payload = contentType.includes('application/json')
      ? await response.json()
      : {
          success: false,
          message: await response.text(),
        }

    if (!response.ok) {
      const messageParts = [String(payload.message ?? 'Request failed')]
      const errorCode = typeof payload.errorCode === 'string' ? payload.errorCode : ''
      const requestId = typeof payload.requestId === 'string' ? payload.requestId : ''
      const stage = typeof payload.details?.stage === 'string' ? payload.details.stage : ''

      if (errorCode) messageParts.push(`Código: ${errorCode}`)
      if (stage) messageParts.push(`Etapa: ${stage}`)
      if (requestId) messageParts.push(`Solicitud: ${requestId}`)

      const message = messageParts.join(' · ')
      if (isAuthExpired(response.status, message)) {
        clearSessionAndRedirectToLogin()
      }
      throw new Error(message)
    }

    return payload
  } finally {
    endAppActivity()
  }
}

async function publicRequest<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  beginAppActivity()
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...withJsonHeader(init?.headers, init?.body ?? null),
      },
    })

    const contentType = response.headers.get('content-type') ?? ''
    const payload = contentType.includes('application/json')
      ? await response.json()
      : {
          success: false,
          message: await response.text(),
        }

    if (!response.ok) {
      throw new Error(payload.message ?? 'Request failed')
    }

    return payload
  } finally {
    endAppActivity()
  }
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  getNavigation: () =>
    request<NavigationMenuDto>('/navigation'),
  getNavigationAdmin: () =>
    request<NavigationAdminDto>('/navigation/admin'),
  createNavigationSection: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/navigation/sections', { method: 'POST', body: JSON.stringify(payload) }),
  updateNavigationSection: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/navigation/sections/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteNavigationSection: (id: string) =>
    request<{ id: string }>(`/navigation/sections/${id}`, { method: 'DELETE' }),
  createNavigationItem: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/navigation/items', { method: 'POST', body: JSON.stringify(payload) }),
  updateNavigationItem: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/navigation/items/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteNavigationItem: (id: string) =>
    request<{ id: string }>(`/navigation/items/${id}`, { method: 'DELETE' }),
  getDashboard: () =>
    request<{
      metrics: { label: string; value: string | number }[]
      announcements: { id: string; title: string; publishedAt: string | null }[]
    }>('/dashboard'),
  getStudents: ({
    query = '',
    year,
    gradeId = '',
    groupId = '',
    page = 1,
    pageSize = 10,
  }: {
    query?: string
    year?: string | number
    gradeId?: string
    groupId?: string
    page?: number
    pageSize?: number
  }) =>
    request<PaginatedResponse<StudentDto>>(
      `/students?query=${encodeURIComponent(query)}&year=${year ? encodeURIComponent(String(year)) : ''}&gradeId=${encodeURIComponent(gradeId)}&groupId=${encodeURIComponent(groupId)}&page=${page}&pageSize=${pageSize}`,
    ),
  createStudent: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/students', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateStudent: (id: string, payload: Record<string, unknown>) =>
    request<StudentDto>(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteStudent: (id: string) =>
    request<{ id: string }>(`/students/${id}`, {
      method: 'DELETE',
    }),
  getStudentAdmissionProfile: (id: string, year?: string | number) =>
    request<StudentAdmissionProfileDto>(
      `/students/${encodeURIComponent(id)}/admission-profile${year ? `?year=${encodeURIComponent(String(year))}` : ''}`,
    ),
  getAcademicYears: ({ query = '', page = 1, pageSize = 10 }: { query?: string; page?: number; pageSize?: number }) =>
    request<PaginatedResponse<AcademicYearDto>>(
      `/academic/years?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
    ),
  createAcademicYear: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/years', { method: 'POST', body: JSON.stringify(payload) }),
  updateAcademicYear: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/years/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAcademicYear: (id: string) =>
    request<{ id: string }>(`/academic/years/${id}`, { method: 'DELETE' }),
  getAcademicPeriods: ({ query = '', page = 1, pageSize = 10 }: { query?: string; page?: number; pageSize?: number }) =>
    request<PaginatedResponse<AcademicPeriodDto>>(
      `/academic/periods?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
    ),
  createAcademicPeriod: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/periods', { method: 'POST', body: JSON.stringify(payload) }),
  updateAcademicPeriod: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/periods/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  updateAcademicPeriodStatus: (id: string, payload: { status: 'open' | 'published' | 'closed' }) =>
    request<AcademicPeriodStatusChangeResultDto>(`/academic/periods/${id}/status`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteAcademicPeriod: (id: string) =>
    request<{ id: string }>(`/academic/periods/${id}`, { method: 'DELETE' }),
  getAcademicGrades: ({ query = '', page = 1, pageSize = 10 }: { query?: string; page?: number; pageSize?: number }) =>
    request<PaginatedResponse<AcademicGradeDto>>(
      `/academic/grades?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
    ),
  getAcademicYearLevels: ({ query = '', academicYearId = '', journeyId = '', page = 1, pageSize = 10 }: { query?: string; academicYearId?: string; journeyId?: string; page?: number; pageSize?: number }) =>
    request<PaginatedResponse<AcademicYearLevelDto>>(
      `/academic/year-levels?query=${encodeURIComponent(query)}&academicYearId=${encodeURIComponent(academicYearId)}&journeyId=${encodeURIComponent(journeyId)}&page=${page}&pageSize=${pageSize}`,
    ),
  createAcademicGrade: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/grades', { method: 'POST', body: JSON.stringify(payload) }),
  createAcademicYearLevel: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/year-levels', { method: 'POST', body: JSON.stringify(payload) }),
  updateAcademicGrade: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/grades/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  updateAcademicYearLevel: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/year-levels/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAcademicGrade: (id: string) =>
    request<{ id: string }>(`/academic/grades/${id}`, { method: 'DELETE' }),
  deleteAcademicYearLevel: (id: string) =>
    request<{ id: string }>(`/academic/year-levels/${id}`, { method: 'DELETE' }),
  getCourses: ({ query = '', page = 1, pageSize = 10 }: { query?: string; page?: number; pageSize?: number }) =>
    request<PaginatedResponse<CourseDto>>(
      `/academic/courses?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
    ),
  createCourse: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/courses', { method: 'POST', body: JSON.stringify(payload) }),
  updateCourse: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/courses/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteCourse: (id: string) =>
    request<{ id: string }>(`/academic/courses/${id}`, { method: 'DELETE' }),
  getSubjects: ({ query = '', page = 1, pageSize = 10 }: { query?: string; page?: number; pageSize?: number }) =>
    request<PaginatedResponse<SubjectDto>>(
      `/academic/subjects?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
    ),
  createSubject: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/subjects', { method: 'POST', body: JSON.stringify(payload) }),
  updateSubject: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/subjects/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteSubject: (id: string) =>
    request<{ id: string }>(`/academic/subjects/${id}`, { method: 'DELETE' }),
  getGradeSubjects: ({
    query = '',
    academicYearId = '',
    gradeId = '',
    page = 1,
    pageSize = 10,
  }: {
    query?: string
    academicYearId?: string
    gradeId?: string
    page?: number
    pageSize?: number
  }) =>
    request<PaginatedResponse<GradeSubjectDto>>(
      `/academic/grade-subjects?query=${encodeURIComponent(query)}&academicYearId=${encodeURIComponent(academicYearId)}&gradeId=${encodeURIComponent(gradeId)}&page=${page}&pageSize=${pageSize}`,
    ),
  createGradeSubject: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/grade-subjects', { method: 'POST', body: JSON.stringify(payload) }),
  updateGradeSubject: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/grade-subjects/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteGradeSubject: (id: string) =>
    request<{ id: string }>(`/academic/grade-subjects/${id}`, { method: 'DELETE' }),
  getTeachers: ({ query = '', page = 1, pageSize = 10 }: { query?: string; page?: number; pageSize?: number }) =>
    request<PaginatedResponse<TeacherDto>>(
      `/academic/teachers?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
    ),
  createTeacher: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/teachers', { method: 'POST', body: JSON.stringify(payload) }),
  updateTeacher: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/teachers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTeacher: (id: string) =>
    request<{ id: string }>(`/academic/teachers/${id}`, { method: 'DELETE' }),
  getTeacherUserCandidates: () =>
    request<{ items: TeacherUserCandidateDto[] }>('/academic/teacher-user-candidates'),
  getRoles: () =>
    request<{ items: RoleOptionDto[] }>('/users/roles'),
  getUsers: ({ query = '', page = 1, pageSize = 10 }: { query?: string; page?: number; pageSize?: number }) =>
    request<PaginatedResponse<UserManagementDto>>(
      `/users?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
    ),
  createUser: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateUser: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteUser: (id: string) =>
    request<{ id: string }>(`/users/${id}`, { method: 'DELETE' }),
  getCourseSubjects: ({
    academicYearId = '',
    groupId = '',
    teacherId = '',
  }: {
    academicYearId?: string
    groupId?: string
    teacherId?: string
  }) =>
    request<{ items: CourseSubjectDto[] }>(
      `/academic/course-subjects?academicYearId=${encodeURIComponent(academicYearId)}&groupId=${encodeURIComponent(groupId)}&teacherId=${encodeURIComponent(teacherId)}`,
    ),
  createCourseSubject: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/course-subjects', { method: 'POST', body: JSON.stringify(payload) }),
  updateCourseSubject: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/course-subjects/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteCourseSubject: (id: string) =>
    request<{ id: string }>(`/academic/course-subjects/${id}`, { method: 'DELETE' }),
  getTeacherResponsibilities: ({
    academicYearId = '',
    responsibilityType = '',
    teacherId = '',
  }: {
    academicYearId?: string
    responsibilityType?: string
    teacherId?: string
  }) =>
    request<{ items: TeacherResponsibilityDto[] }>(
      `/academic/teacher-responsibilities?academicYearId=${encodeURIComponent(academicYearId)}&responsibilityType=${encodeURIComponent(responsibilityType)}&teacherId=${encodeURIComponent(teacherId)}`,
    ),
  createTeacherResponsibility: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/teacher-responsibilities', { method: 'POST', body: JSON.stringify(payload) }),
  updateTeacherResponsibility: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/teacher-responsibilities/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTeacherResponsibility: (id: string) =>
    request<{ id: string }>(`/academic/teacher-responsibilities/${id}`, { method: 'DELETE' }),
  getJourneys: ({ academicYearId = '', branchId = '' }: { academicYearId?: string; branchId?: string }) =>
    request<{ items: AcademicYearJourneyDto[] }>(
      `/academic/journeys?academicYearId=${encodeURIComponent(academicYearId)}&branchId=${encodeURIComponent(branchId)}`,
    ),
  createJourney: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/journeys', { method: 'POST', body: JSON.stringify(payload) }),
  updateJourney: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/journeys/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteJourney: (id: string) =>
    request<{ id: string }>(`/academic/journeys/${id}`, { method: 'DELETE' }),
  getJourneySlots: (journeyId: string) =>
    request<{ items: AcademicYearJourneySlotDto[] }>(
      `/academic/journey-slots?journeyId=${encodeURIComponent(journeyId)}`,
    ),
  createJourneySlot: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/journey-slots', { method: 'POST', body: JSON.stringify(payload) }),
  updateJourneySlot: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/journey-slots/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteJourneySlot: (id: string) =>
    request<{ id: string }>(`/academic/journey-slots/${id}`, { method: 'DELETE' }),
  getGroupJourneyOptions: ({
    academicYearId = '',
    groupId = '',
    journeyId = '',
  }: {
    academicYearId?: string
    groupId?: string
    journeyId?: string
  }) =>
    request<{ items: GroupJourneyOptionDto[] }>(
      `/academic/group-journey-options?academicYearId=${encodeURIComponent(academicYearId)}&groupId=${encodeURIComponent(groupId)}&journeyId=${encodeURIComponent(journeyId)}`,
    ),
  createGroupJourneyOption: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/group-journey-options', { method: 'POST', body: JSON.stringify(payload) }),
  updateGroupJourneyOption: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/group-journey-options/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteGroupJourneyOption: (id: string) =>
    request<{ id: string }>(`/academic/group-journey-options/${id}`, { method: 'DELETE' }),
  getTimetable: ({ academicYearId, groupId = '', journeyId = '', teacherId = '' }: { academicYearId: string; groupId?: string; journeyId?: string; teacherId?: string }) =>
    request<{ items: GroupTimetableEntryDto[] }>(
      `/academic/timetable?academicYearId=${encodeURIComponent(academicYearId)}&groupId=${encodeURIComponent(groupId)}&journeyId=${encodeURIComponent(journeyId)}&teacherId=${encodeURIComponent(teacherId)}`,
    ),
  updateTimetableEntry: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/timetable/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  updateTimetableStatus: (payload: Record<string, unknown>) =>
    request<TimetableStatusChangeResultDto>('/academic/timetable/status', { method: 'PATCH', body: JSON.stringify(payload) }),
  generateTimetable: (payload: Record<string, unknown>) =>
    request<TimetableGenerationResultDto>('/academic/timetable/generate', { method: 'POST', body: JSON.stringify(payload) }),
  getLearningAchievements: ({
    query = '',
    academicYearId = '',
    academicPeriodId = '',
    gradeId = '',
    subjectId = '',
    page = 1,
    pageSize = 10,
  }: {
    query?: string
    academicYearId?: string
    academicPeriodId?: string
    gradeId?: string
    subjectId?: string
    page?: number
    pageSize?: number
  }) =>
    request<PaginatedResponse<LearningAchievementDto>>(
      `/academic/achievements?query=${encodeURIComponent(query)}&academicYearId=${encodeURIComponent(academicYearId)}&academicPeriodId=${encodeURIComponent(academicPeriodId)}&gradeId=${encodeURIComponent(gradeId)}&subjectId=${encodeURIComponent(subjectId)}&page=${page}&pageSize=${pageSize}`,
    ),
  createLearningAchievement: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/achievements', { method: 'POST', body: JSON.stringify(payload) }),
  updateLearningAchievement: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/achievements/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteLearningAchievement: (id: string) =>
    request<{ id: string }>(`/academic/achievements/${id}`, { method: 'DELETE' }),
  getGradebook: ({
    academicYearId,
    groupId,
    subjectId,
    academicPeriodId,
  }: {
    academicYearId: string
    groupId: string
    subjectId: string
    academicPeriodId: string
  }) =>
    request<GradebookResponseDto>(
      `/academic/gradebook?academicYearId=${encodeURIComponent(academicYearId)}&groupId=${encodeURIComponent(groupId)}&subjectId=${encodeURIComponent(subjectId)}&academicPeriodId=${encodeURIComponent(academicPeriodId)}`,
    ),
  saveGradebook: (payload: Record<string, unknown>) =>
    request<{ updatedCount: number }>('/academic/gradebook', { method: 'POST', body: JSON.stringify(payload) }),
  getStudentReportCard: ({
    academicYearId,
    academicPeriodId,
    studentId,
  }: {
    academicYearId: string
    academicPeriodId: string
    studentId: string
  }) =>
    request<StudentReportCardDto>(
      `/academic/report-cards/student?academicYearId=${encodeURIComponent(academicYearId)}&academicPeriodId=${encodeURIComponent(academicPeriodId)}&studentId=${encodeURIComponent(studentId)}`,
    ),
  getAnnualStudentReportCard: ({
    academicYearId,
    studentId,
  }: {
    academicYearId: string
    studentId: string
  }) =>
    request<AnnualStudentReportCardDto>(
      `/academic/report-cards/student-annual?academicYearId=${encodeURIComponent(academicYearId)}&studentId=${encodeURIComponent(studentId)}`,
    ),
  getEnrollmentFormEditor: (year: string | number) =>
    request<Record<string, unknown>>(`/enrollment-forms/${encodeURIComponent(String(year))}`),
  saveEnrollmentFormDraft: (year: string | number, payload: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/enrollment-forms/${encodeURIComponent(String(year))}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  publishEnrollmentForm: (year: string | number, payload: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/enrollment-forms/${encodeURIComponent(String(year))}/publish`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAdmissionProcess: (year: string | number) =>
    request<AdmissionProcessDto>(`/admissions/process/${encodeURIComponent(String(year))}`),
  getActiveAdmissionForm: (year: string | number) =>
    request<AdmissionActiveFormDto>(`/admissions/forms/${encodeURIComponent(String(year))}/active`),
  getAdmissionOverview: (year: string | number) =>
    request<AdmissionOverviewDto>(`/admissions/overview/${encodeURIComponent(String(year))}`),
  saveAdmissionProcess: (year: string | number, payload: Record<string, unknown>) =>
    request<AdmissionProcessDto>(`/admissions/process/${encodeURIComponent(String(year))}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getAdmissionApplications: ({
    year,
    status = '',
    gradeId = '',
    groupId = '',
    query = '',
    page = 1,
    pageSize = 10,
  }: {
    year?: string | number
    status?: string
    gradeId?: string
    groupId?: string
    query?: string
    page?: number
    pageSize?: number
  }) =>
    request<PaginatedResponse<AdmissionApplicationDto>>(
      `/admissions/applications?year=${year ? encodeURIComponent(String(year)) : ''}&status=${encodeURIComponent(status)}&gradeId=${encodeURIComponent(gradeId)}&groupId=${encodeURIComponent(groupId)}&query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
    ),
  getAdmissionApplicationDetail: (id: string) =>
    request<AdmissionApplicationDetailDto>(`/admissions/applications/${encodeURIComponent(id)}`),
  createManualAdmission: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/admissions/applications/manual', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAdmissionApplication: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/admissions/applications/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateAdmissionStatus: (id: string, payload: Record<string, unknown>) =>
    request<AdmissionStatusChangeResultDto>(`/admissions/applications/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  convertAdmissionToEnrollment: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/admissions/applications/${id}/convert-to-enrollment`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getEnrollments: ({
    year,
    gradeId = '',
    groupId = '',
    query = '',
    page = 1,
    pageSize = 10,
  }: {
    year?: string | number
    gradeId?: string
    groupId?: string
    query?: string
    page?: number
    pageSize?: number
  }) =>
    request<PaginatedResponse<EnrollmentDto>>(
      `/enrollments?year=${year ? encodeURIComponent(String(year)) : ''}&gradeId=${encodeURIComponent(gradeId)}&groupId=${encodeURIComponent(groupId)}&query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
    ),
  createEnrollment: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/enrollments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getEnrollmentCandidates: ({
    year,
    query = '',
    page = 1,
    pageSize = 25,
  }: {
    year: string | number
    query?: string
    page?: number
    pageSize?: number
  }) =>
    request<PaginatedResponse<EnrollmentCandidateDto>>(
      `/enrollments/candidates?year=${encodeURIComponent(String(year))}&query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
    ),
  getEnrollmentContinuityPreview: ({
    year,
    mode,
    sourceGradeId = '',
    query = '',
  }: {
    year: string | number
    mode: 'renewal' | 'promotion' | 'auto_promotion'
    sourceGradeId?: string
    query?: string
  }) =>
    request<EnrollmentContinuityPreviewDto>(
      `/enrollments/continuity-preview?year=${encodeURIComponent(String(year))}&mode=${encodeURIComponent(mode)}&sourceGradeId=${encodeURIComponent(sourceGradeId)}&query=${encodeURIComponent(query)}`,
    ),
  createEnrollmentContinuityBatch: (payload: Record<string, unknown>) =>
    request<EnrollmentBatchCreateResultDto>('/enrollments/continuity-batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAnnualPromotionPreview: ({
    year,
    gradeId = '',
    groupId = '',
    query = '',
  }: {
    year: string | number
    gradeId?: string
    groupId?: string
    query?: string
  }) =>
    request<AnnualPromotionPreviewDto>(
      `/enrollments/annual-promotion-preview?year=${encodeURIComponent(String(year))}&gradeId=${encodeURIComponent(gradeId)}&groupId=${encodeURIComponent(groupId)}&query=${encodeURIComponent(query)}`,
    ),
  saveAnnualPromotionDecisions: (payload: { academicYearId: string; items: Array<{ enrollmentId: string; promotionStatus: 'pending' | 'promoted' | 'not_promoted' | 'conditional' }> }) =>
    request<AnnualPromotionDecisionResultDto>('/enrollments/annual-promotion-decisions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getPublicAdmissionProcess: (tenantSlug: string, year: string) =>
    publicRequest<Record<string, unknown>>(
      `/public/tenants/${encodeURIComponent(tenantSlug)}/inscriptions/${encodeURIComponent(year)}`,
    ),
  submitPublicAdmission: (tenantSlug: string, year: string, payload: Record<string, unknown>) =>
    publicRequest<Record<string, unknown>>(
      `/public/tenants/${encodeURIComponent(tenantSlug)}/inscriptions/${encodeURIComponent(year)}/submissions`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),
  submitPublicAdmissionWithFiles: (tenantSlug: string, year: string, payload: FormData) =>
    publicRequest<Record<string, unknown>>(
      `/public/tenants/${encodeURIComponent(tenantSlug)}/inscriptions/${encodeURIComponent(year)}/submissions`,
      {
        method: 'POST',
        body: payload,
      },
    ),
  downloadAdmissionDocument: async (id: string, fileName: string) => {
    const response = await fetch(`${API_URL}/admissions/documents/${encodeURIComponent(id)}/download`, {
      method: 'GET',
      headers: {
        ...getHeaders(),
      },
    })

    if (!response.ok) {
      const message = await response.text()
      if (isAuthExpired(response.status, message)) {
        clearSessionAndRedirectToLogin()
      }
      throw new Error(message || 'No fue posible descargar el documento')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },

  // Academic Areas CRUD
  getAcademicAreas: ({ query = '', page = 1, pageSize = 10 }: { query?: string; page?: number; pageSize?: number }) =>
    request<PaginatedResponse<AcademicAreaDto>>(
      `/academic/academic-areas?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
    ),
  createAcademicArea: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/academic-areas', { method: 'POST', body: JSON.stringify(payload) }),
  updateAcademicArea: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/academic-areas/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAcademicArea: (id: string) =>
    request<{ id: string }>(`/academic/academic-areas/${id}`, { method: 'DELETE' }),

  // Grading Scales CRUD
  getGradingScales: ({ query = '', page = 1, pageSize = 10 }: { query?: string; page?: number; pageSize?: number }) =>
    request<PaginatedResponse<GradingScaleDto>>(
      `/academic/grading-scales?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
    ),
  createGradingScale: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/grading-scales', { method: 'POST', body: JSON.stringify(payload) }),
  updateGradingScale: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/grading-scales/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteGradingScale: (id: string) =>
    request<{ id: string }>(`/academic/grading-scales/${id}`, { method: 'DELETE' }),

  // Performance Ranges CRUD
  getPerformanceRanges: (gradingScaleId?: string) =>
    request<{ items: PerformanceRangeDto[] }>(
      `/academic/performance-ranges${gradingScaleId ? `?gradingScaleId=${encodeURIComponent(gradingScaleId)}` : ''}`,
    ),
  getGradingScaleAssignments: (academicYearId?: string) =>
    request<{ items: GradingScaleAssignmentDto[] }>(
      `/academic/grading-scale-assignments${academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : ''}`,
    ),
  createGradingScaleAssignment: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/grading-scale-assignments', { method: 'POST', body: JSON.stringify(payload) }),
  updateGradingScaleAssignment: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/grading-scale-assignments/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteGradingScaleAssignment: (id: string) =>
    request<{ id: string }>(`/academic/grading-scale-assignments/${id}`, { method: 'DELETE' }),
  createPerformanceRange: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/performance-ranges', { method: 'POST', body: JSON.stringify(payload) }),
  updatePerformanceRange: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/performance-ranges/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deletePerformanceRange: (id: string) =>
    request<{ id: string }>(`/academic/performance-ranges/${id}`, { method: 'DELETE' }),

  // Competencies CRUD
  getCompetencies: ({
    query = '',
    page = 1,
    pageSize = 10,
    academicAreaId = '',
    subjectId = '',
    gradeId = '',
  }: {
    query?: string
    page?: number
    pageSize?: number
    academicAreaId?: string
    subjectId?: string
    gradeId?: string
  }) => {
    let url = `/academic/competencies?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`
    if (academicAreaId) url += `&academicAreaId=${encodeURIComponent(academicAreaId)}`
    if (subjectId) url += `&subjectId=${encodeURIComponent(subjectId)}`
    if (gradeId) url += `&gradeId=${encodeURIComponent(gradeId)}`
    return request<PaginatedResponse<CompetencyDto>>(url)
  },
  createCompetency: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/competencies', { method: 'POST', body: JSON.stringify(payload) }),
  updateCompetency: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/competencies/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteCompetency: (id: string) =>
    request<{ id: string }>(`/academic/competencies/${id}`, { method: 'DELETE' }),

  // Achievement Indicators CRUD
  getAchievementIndicators: (achievementId?: string) =>
    request<{ items: AchievementIndicatorDto[] }>(
      `/academic/achievement-indicators${achievementId ? `?achievementId=${encodeURIComponent(achievementId)}` : ''}`,
    ),
  createAchievementIndicator: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/achievement-indicators', { method: 'POST', body: JSON.stringify(payload) }),
  updateAchievementIndicator: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/achievement-indicators/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAchievementIndicator: (id: string) =>
    request<{ id: string }>(`/academic/achievement-indicators/${id}`, { method: 'DELETE' }),

  // Evaluation Activities CRUD
  getEvaluationActivities: (filters: { academicYearId: string; academicPeriodId: string; groupId: string; subjectId: string }) => {
    let url = `/academic/evaluation-activities?academicYearId=${encodeURIComponent(filters.academicYearId)}&academicPeriodId=${encodeURIComponent(filters.academicPeriodId)}&groupId=${encodeURIComponent(filters.groupId)}&subjectId=${encodeURIComponent(filters.subjectId)}`
    return request<{ items: EvaluationActivityDto[] }>(url)
  },
  getEvaluationActivity: (id: string) =>
    request<EvaluationActivityDto>(`/academic/evaluation-activities/${encodeURIComponent(id)}`),
  createEvaluationActivity: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/evaluation-activities', { method: 'POST', body: JSON.stringify(payload) }),
  updateEvaluationActivity: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/evaluation-activities/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteEvaluationActivity: (id: string) =>
    request<{ id: string }>(`/academic/evaluation-activities/${id}`, { method: 'DELETE' }),

  // Evaluation Activity Scores
  getEvaluationActivityScores: (activityId: string) =>
    request<ActivityScoresResponseDto>(`/academic/evaluation-activities/${encodeURIComponent(activityId)}/scores`),
  saveEvaluationActivityScores: (activityId: string, scores: { studentId: string; score: number; observations?: string | null }[]) =>
    request<{ updatedCount: number }>(`/academic/evaluation-activities/${encodeURIComponent(activityId)}/scores`, {
      method: 'POST',
      body: JSON.stringify({ scores }),
    }),

  // Attendance
  getAttendance: (filters: { academicYearId: string; academicPeriodId: string; groupId: string; subjectId: string; attendanceDate: string }) => {
    let url = `/academic/attendance?academicYearId=${encodeURIComponent(filters.academicYearId)}&academicPeriodId=${encodeURIComponent(filters.academicPeriodId)}&groupId=${encodeURIComponent(filters.groupId)}&subjectId=${encodeURIComponent(filters.subjectId)}&attendanceDate=${encodeURIComponent(filters.attendanceDate)}`
    return request<{ items: AttendanceEntryDto[] }>(url)
  },
  saveAttendance: (payload: {
    academicYearId: string
    academicPeriodId: string
    groupId: string
    subjectId: string
    attendanceDate: string
    items: Array<{ studentId: string; status: string; justified: boolean; notes?: string | null }>
  }) =>
    request<{ updatedCount: number }>('/academic/attendance', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Academic Observations CRUD
  getAcademicObservations: (filters: { academicYearId?: string; academicPeriodId?: string; studentId?: string; subjectId?: string }) => {
    let url = '/academic/academic-observations?'
    if (filters.academicYearId) url += `academicYearId=${encodeURIComponent(filters.academicYearId)}&`
    if (filters.academicPeriodId) url += `academicPeriodId=${encodeURIComponent(filters.academicPeriodId)}&`
    if (filters.studentId) url += `studentId=${encodeURIComponent(filters.studentId)}&`
    if (filters.subjectId) url += `subjectId=${encodeURIComponent(filters.subjectId)}`
    return request<{ items: AcademicObservationDto[] }>(url)
  },
  createAcademicObservation: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/academic-observations', { method: 'POST', body: JSON.stringify(payload) }),
  updateAcademicObservation: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/academic-observations/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAcademicObservation: (id: string) =>
    request<{ id: string }>(`/academic/academic-observations/${id}`, { method: 'DELETE' }),

  // Observation Bank CRUD
  getObservationBank: (filters: { subjectId?: string; gradeId?: string; performanceLevel?: string }) => {
    let url = '/academic/observation-bank?'
    if (filters.subjectId) url += `subjectId=${encodeURIComponent(filters.subjectId)}&`
    if (filters.gradeId) url += `gradeId=${encodeURIComponent(filters.gradeId)}&`
    if (filters.performanceLevel) url += `performanceLevel=${encodeURIComponent(filters.performanceLevel)}`
    return request<{ items: ObservationBankDto[] }>(url)
  },
  createObservationBank: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/observation-bank', { method: 'POST', body: JSON.stringify(payload) }),
  updateObservationBank: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/observation-bank/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteObservationBank: (id: string) =>
    request<{ id: string }>(`/academic/observation-bank/${id}`, { method: 'DELETE' }),

  // Support Strategies CRUD
  getSupportStrategies: (filters: { academicYearId?: string; academicPeriodId?: string; studentId?: string; subjectId?: string }) => {
    let url = '/academic/support-strategies?'
    if (filters.academicYearId) url += `academicYearId=${encodeURIComponent(filters.academicYearId)}&`
    if (filters.academicPeriodId) url += `academicPeriodId=${encodeURIComponent(filters.academicPeriodId)}&`
    if (filters.studentId) url += `studentId=${encodeURIComponent(filters.studentId)}&`
    if (filters.subjectId) url += `subjectId=${encodeURIComponent(filters.subjectId)}`
    return request<{ items: SupportStrategyDto[] }>(url)
  },
  createSupportStrategy: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/academic/support-strategies', { method: 'POST', body: JSON.stringify(payload) }),
  updateSupportStrategy: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/academic/support-strategies/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteSupportStrategy: (id: string) =>
    request<{ id: string }>(`/academic/support-strategies/${id}`, { method: 'DELETE' }),

  // Recalculate Period Grades
  calculatePeriodGrades: (payload: { academicYearId: string; academicPeriodId: string; groupId: string; subjectId: string }) =>
    request<{ updatedCount: number }>('/academic/gradebook/calculate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Committees
  getCommittees: ({ query = '', page = 1, pageSize = 10 }: { query?: string; page?: number; pageSize?: number }) =>
    request<PaginatedResponse<CommitteeDto>>(
      `/committees?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
    ),
  getCommittee: (id: string) =>
    request<CommitteeDetailDto>(`/committees/${id}`),
  createCommittee: (payload: Record<string, unknown>) =>
    request<{ id: string; meetingNumber: number }>('/committees', { method: 'POST', body: JSON.stringify(payload) }),
  updateCommittee: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string; status: string }>(`/committees/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteCommittee: (id: string) =>
    request<{ id: string }>(`/committees/${id}`, { method: 'DELETE' }),
  createCommitteeDecision: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/committees/${id}/decisions`, { method: 'POST', body: JSON.stringify(payload) }),

  // Coexistence
  getCoexistenceCases: ({ query = '', page = 1, pageSize = 10 }: { query?: string; page?: number; pageSize?: number }) =>
    request<PaginatedResponse<CoexistenceCaseDto>>(
      `/coexistence?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
    ),
  getCoexistenceCase: (id: string) =>
    request<CoexistenceCaseDetailDto>(`/coexistence/${id}`),
  createCoexistenceCase: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/coexistence', { method: 'POST', body: JSON.stringify(payload) }),
  updateCoexistenceCase: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string; status: string }>(`/coexistence/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  createCoexistenceIntervention: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/coexistence/${id}/interventions`, { method: 'POST', body: JSON.stringify(payload) }),

  // PIAR
  getPiarRecords: () =>
    request<{ items: PiarRecordDto[] }>('/piar'),
  getPiarRecord: (id: string) =>
    request<PiarRecordDetailDto>(`/piar/${id}`),
  createPiarRecord: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/piar', { method: 'POST', body: JSON.stringify(payload) }),
  createPiarAdjustment: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/piar/${id}/adjustments`, { method: 'POST', body: JSON.stringify(payload) }),
  createPiarFollowUp: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/piar/${id}/follow-ups`, { method: 'POST', body: JSON.stringify(payload) }),
}
