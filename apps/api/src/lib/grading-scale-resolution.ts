import { and, asc, eq } from 'drizzle-orm'
import { grades, gradingScaleAssignments, gradingScales, performanceRanges } from '@ofir/db'
import type { Database } from '@ofir/db'
import { AppError } from './errors'

export interface ResolvedGradingScale {
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

export const resolveDisplayedGradeValue = ({
  score,
  scale,
}: {
  score: number
  scale: ResolvedGradingScale
}) => {
  const matchingRange = scale.ranges.find((range) => score >= range.minScore && score <= range.maxScore)
  const fallbackRange = matchingRange ?? scale.ranges.find((range) => score >= range.minScore - 0.001 && score <= range.maxScore + 0.001)

  if (scale.scaleType === 'numeric') {
    return score.toFixed(scale.decimalPlaces)
  }

  return fallbackRange?.institutionalLabel ?? fallbackRange?.nationalLevel ?? score.toFixed(scale.decimalPlaces)
}

const normalizeScale = (scale: {
  id: string
  name: string
  minValue: string
  maxValue: string
  passingValue: string
  decimalPlaces: number
  scaleType: string
}) => ({
  id: scale.id,
  name: scale.name,
  minValue: Number(scale.minValue),
  maxValue: Number(scale.maxValue),
  passingValue: Number(scale.passingValue),
  decimalPlaces: scale.decimalPlaces,
  scaleType: scale.scaleType,
})

export const resolveGradingScaleForGrade = async ({
  db,
  tenantId,
  academicYearId,
  gradeId,
}: {
  db: Database
  tenantId: string
  academicYearId: string
  gradeId: string
}): Promise<ResolvedGradingScale> => {
  const [grade] = await db
    .select({
      id: grades.id,
      levelName: grades.levelName,
    })
    .from(grades)
    .where(and(eq(grades.tenantId, tenantId), eq(grades.id, gradeId), eq(grades.isDeleted, false)))
    .limit(1)

  if (!grade) throw new AppError('No se encontró el grado para resolver la escala de calificación.', 404)

  const [gradeAssignment] = await db
    .select({
      id: gradingScales.id,
      name: gradingScales.name,
      minValue: gradingScales.minValue,
      maxValue: gradingScales.maxValue,
      passingValue: gradingScales.passingValue,
      decimalPlaces: gradingScales.decimalPlaces,
      scaleType: gradingScales.scaleType,
    })
    .from(gradingScaleAssignments)
    .innerJoin(gradingScales, eq(gradingScales.id, gradingScaleAssignments.gradingScaleId))
    .where(and(
      eq(gradingScaleAssignments.tenantId, tenantId),
      eq(gradingScaleAssignments.academicYearId, academicYearId),
      eq(gradingScaleAssignments.scopeType, 'grade'),
      eq(gradingScaleAssignments.gradeId, gradeId),
      eq(gradingScaleAssignments.isActive, true),
      eq(gradingScaleAssignments.isDeleted, false),
      eq(gradingScales.isDeleted, false),
    ))
    .limit(1)

  const [levelAssignment] = grade.levelName
    ? await db
        .select({
          id: gradingScales.id,
          name: gradingScales.name,
          minValue: gradingScales.minValue,
          maxValue: gradingScales.maxValue,
          passingValue: gradingScales.passingValue,
          decimalPlaces: gradingScales.decimalPlaces,
          scaleType: gradingScales.scaleType,
        })
        .from(gradingScaleAssignments)
        .innerJoin(gradingScales, eq(gradingScales.id, gradingScaleAssignments.gradingScaleId))
        .where(and(
          eq(gradingScaleAssignments.tenantId, tenantId),
          eq(gradingScaleAssignments.academicYearId, academicYearId),
          eq(gradingScaleAssignments.scopeType, 'level'),
          eq(gradingScaleAssignments.levelName, grade.levelName),
          eq(gradingScaleAssignments.isActive, true),
          eq(gradingScaleAssignments.isDeleted, false),
          eq(gradingScales.isDeleted, false),
        ))
        .limit(1)
    : []

  const [globalScale] = await db
    .select({
      id: gradingScales.id,
      name: gradingScales.name,
      minValue: gradingScales.minValue,
      maxValue: gradingScales.maxValue,
      passingValue: gradingScales.passingValue,
      decimalPlaces: gradingScales.decimalPlaces,
      scaleType: gradingScales.scaleType,
    })
    .from(gradingScales)
    .where(and(
      eq(gradingScales.tenantId, tenantId),
      eq(gradingScales.isActive, true),
      eq(gradingScales.isDeleted, false),
    ))
    .limit(1)

  const selectedScale = gradeAssignment ?? levelAssignment ?? globalScale

  if (!selectedScale) {
    throw new AppError('No se encontró una escala de calificación activa para este grado.', 500)
  }

  const ranges = await db
    .select({
      nationalLevel: performanceRanges.nationalLevel,
      institutionalLabel: performanceRanges.institutionalLabel,
      minScore: performanceRanges.minScore,
      maxScore: performanceRanges.maxScore,
      isPassing: performanceRanges.isPassing,
      color: performanceRanges.color,
    })
    .from(performanceRanges)
    .where(and(
      eq(performanceRanges.tenantId, tenantId),
      eq(performanceRanges.gradingScaleId, selectedScale.id),
      eq(performanceRanges.isDeleted, false),
    ))
    .orderBy(asc(performanceRanges.minScore))

  return {
    ...normalizeScale(selectedScale),
    ranges: ranges.map((range) => ({
      nationalLevel: range.nationalLevel,
      institutionalLabel: range.institutionalLabel,
      minScore: Number(range.minScore),
      maxScore: Number(range.maxScore),
      isPassing: range.isPassing,
      color: range.color ?? null,
    })),
  }
}
