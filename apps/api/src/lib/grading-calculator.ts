/**
 * SIEE Grading Calculator Service
 * Evaluates academic performance, handles weighted grading logic, and maps grades to Colombia SIEE levels.
 */

export interface PerformanceRangeInput {
  nationalLevel: string;
  institutionalLabel: string;
  minScore: string | number;
  maxScore: string | number;
  isPassing?: boolean;
  color?: string | null;
}

export interface ActivityScoreInput {
  score: string | number;
  weightPercentage: string | number;
}

/**
 * Finds the corresponding performance range for a given score.
 */
export function calculatePerformanceLevel(
  score: number,
  ranges: PerformanceRangeInput[]
): PerformanceRangeInput | null {
  for (const range of ranges) {
    const min = Number(range.minScore);
    const max = Number(range.maxScore);
    if (score >= min && score <= max) {
      return range;
    }
  }
  
  // Fallback: search with a tiny epsilon for rounding issues
  for (const range of ranges) {
    const min = Number(range.minScore) - 0.001;
    const max = Number(range.maxScore) + 0.001;
    if (score >= min && score <= max) {
      return range;
    }
  }

  return null;
}

/**
 * Calculates the weighted score for a set of evaluation activities.
 * If total weight is less than 100%, it normalizes the weight dynamically.
 */
export function calculateAchievementScore(
  scores: ActivityScoreInput[]
): number {
  if (scores.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const item of scores) {
    const scoreVal = Number(item.score);
    const weightVal = Number(item.weightPercentage);

    weightedSum += scoreVal * weightVal;
    totalWeight += weightVal;
  }

  if (totalWeight === 0) return 0;
  
  // Return rounded to 2 decimal places
  return Number((weightedSum / totalWeight).toFixed(2));
}

/**
 * Calculates the final period score for a subject based on its achievements.
 */
export function calculateSubjectPeriodScore(
  achievements: { score: number; weight: number }[]
): number {
  if (achievements.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const ach of achievements) {
    weightedSum += ach.score * ach.weight;
    totalWeight += ach.weight;
  }

  if (totalWeight === 0) return 0;
  return Number((weightedSum / totalWeight).toFixed(2));
}

/**
 * Calculates the final annual score based on period scores and their weights.
 */
export function calculateAnnualScore(
  periods: { score: number; weightPercentage: number }[]
): number {
  if (periods.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const p of periods) {
    weightedSum += p.score * p.weightPercentage;
    totalWeight += p.weightPercentage;
  }

  if (totalWeight === 0) return 0;
  return Number((weightedSum / totalWeight).toFixed(2));
}
