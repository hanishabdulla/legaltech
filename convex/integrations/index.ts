/**
 * Partner adapters. Every one is a mock in the MVP: nothing leaves the app.
 * The pilot swaps a mock for a real send() per partner.
 *
 * - food_bank_referral: adviser copies the payload into Trussell's e-referral system (invite-only, no public API).
 * - leeds_crisis_payment: pre-filled summary for the council's online form.
 * - fuel_support: mock fuel voucher partner.
 */
export type SendResult = { reference: string; channel: string };

export function sendReferral(scheme: string, _payload: unknown): SendResult {
  const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
  const channel =
    scheme === 'food_bank_referral'
      ? 'Trussell e-referral (copied by adviser)'
      : scheme === 'leeds_crisis_payment'
        ? 'Leeds Crisis Payment online form (pre-filled)'
        : 'Fuel voucher partner (mock)';
  return { reference: `${scheme.slice(0, 2).toUpperCase()}-${ref}`, channel };
}
