/**
 * Service level (mvp2.md §6.4): 4 working hours for high urgency, 2 working
 * days for standard. Working time is Mon–Fri 09:00–17:00 Europe/London.
 */

const STEP = 15 * 60 * 1000;
const DAY_START = 9;
const DAY_END = 17;
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', hour: 'numeric', hourCycle: 'h23' });

function isWorking(ms: number) {
  const parts = fmt.formatToParts(new Date(ms));
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  return !['Sat', 'Sun'].includes(weekday) && hour >= DAY_START && hour < DAY_END;
}

export function addWorkingHours(start: number, hours: number) {
  let t = Math.ceil(start / STEP) * STEP;
  let remaining = hours * 4; // quarter hours
  // Bounded: at most ~3 weeks of 15-minute steps.
  for (let i = 0; remaining > 0 && i < 2000; i++) {
    if (isWorking(t)) remaining--;
    t += STEP;
  }
  return t;
}

export const dueAtFor = (urgency: 'high' | 'standard', from: number) =>
  addWorkingHours(from, urgency === 'high' ? 4 : 2 * (DAY_END - DAY_START));
