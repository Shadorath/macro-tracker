/**
 * Meal and food item helpers used by the Review screen.
 */

export type Confidence = 'high' | 'medium' | 'low';

/** One food as Gemini returns it (matches the response schema in SPEC.md). */
export type FoodItem = {
  name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  confidence: Confidence | '';
};

/**
 * A food on the Review screen. `per100` keeps the values per 100 g from the
 * original estimate, so changing grams recalculates everything locally
 * (macros scale linearly with grams, no new API call).
 */
export type ReviewItem = FoodItem & {
  id: string;
  per100: { kcal: number; protein_g: number; fat_g: number; carbs_g: number };
};

export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

/** Guesses the meal type from the time of day (phone clock). */
export function mealTypeFor(d: Date = new Date()): MealType {
  const minutes = d.getHours() * 60 + d.getMinutes();
  if (minutes >= 5 * 60 && minutes < 10 * 60 + 30) return 'Breakfast';
  if (minutes >= 11 * 60 + 30 && minutes < 14 * 60 + 30) return 'Lunch';
  if (minutes >= 17 * 60 + 30 && minutes < 21 * 60 + 30) return 'Dinner';
  return 'Snack';
}

let nextId = 1;

/** Turns an item into a Review item and remembers its values per 100 g. */
export function toReviewItem(item: FoodItem): ReviewItem {
  const g = item.grams > 0 ? item.grams : 100;
  const per = (v: number) => (v / g) * 100;
  return {
    ...item,
    grams: Math.max(0, Math.round(item.grams)),
    id: `item-${nextId++}`,
    per100: { kcal: per(item.kcal), protein_g: per(item.protein_g), fat_g: per(item.fat_g), carbs_g: per(item.carbs_g) },
  };
}

/** Same item with new grams; kcal and macros recalculated. */
export function withGrams(item: ReviewItem, grams: number): ReviewItem {
  const g = Math.max(0, Math.round(grams));
  const scale = (per100: number) => (per100 * g) / 100;
  return {
    ...item,
    grams: g,
    kcal: scale(item.per100.kcal),
    protein_g: scale(item.per100.protein_g),
    fat_g: scale(item.per100.fat_g),
    carbs_g: scale(item.per100.carbs_g),
  };
}

export function totalsOf(items: FoodItem[]) {
  return items.reduce(
    (t, i) => ({
      kcal: t.kcal + i.kcal,
      protein_g: t.protein_g + i.protein_g,
      fat_g: t.fat_g + i.fat_g,
      carbs_g: t.carbs_g + i.carbs_g,
    }),
    { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
  );
}

/** "P51 F6 C61" – whole grams are enough for a glance. */
export function pfc(t: { protein_g: number; fat_g: number; carbs_g: number }): string {
  return `P${Math.round(t.protein_g)} F${Math.round(t.fat_g)} C${Math.round(t.carbs_g)}`;
}
