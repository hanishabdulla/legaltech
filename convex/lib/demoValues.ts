import type { Facts } from './facts';

/**
 * ILLUSTRATIVE ONLY. These are placeholders for the demo wallet, not real
 * scheme values. Replace with the pilot partner's figures.
 */
export const DEMO_FOOD_VALUE = (f: Facts) => {
  const people = Math.max(1, f.adults ?? 1) + (f.children ?? 0);
  return Math.min(12000, 3000 + 1500 * (people - 1));
};
export const DEMO_FUEL_VALUE = 4900;
export const DEMO_FOOD_VALID_DAYS = 30;
export const DEMO_FUEL_VALID_DAYS = 90;
