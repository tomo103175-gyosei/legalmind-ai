/**
 * SuperMemo-2 Algorithm for spaced repetition.
 * Returns the updated interval, repetition count, and easiness factor.
 * 
 * @param quality User response rating (0-5)
 *                0: complete blackout
 *                1: incorrect response, correct remembered
 *                2: incorrect response, correct easily recalled
 *                3: correct response, recalled with difficulty
 *                4: correct response, after hesitation
 *                5: perfect response
 * @param repetition Current repetition count
 * @param easinessFactor Current easiness factor
 * @param interval Current interval in days
 */
export function calculateSM2(
  quality: number,
  repetition: number,
  easinessFactor: number,
  interval: number
) {
  let nextRepetition = repetition;
  let nextEasinessFactor = easinessFactor;
  let nextInterval = interval;

  if (quality >= 3) {
    if (repetition === 0) {
      nextInterval = 1;
    } else if (repetition === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.round(interval * easinessFactor);
    }
    nextRepetition++;
  } else {
    nextRepetition = 0;
    nextInterval = 1;
  }

  nextEasinessFactor = easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  if (nextEasinessFactor < 1.3) {
    nextEasinessFactor = 1.3;
  }

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + nextInterval);

  return {
    repetition: nextRepetition,
    easinessFactor: nextEasinessFactor,
    interval: nextInterval,
    nextReviewDate
  };
}
