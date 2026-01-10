/**
 * Hardcoded user identity.
 *
 * WhatsApp exports often use your real name / phone number instead of "You".
 * We use this config to reliably:
 * - mark outgoing messages (right aligned, green bubble)
 * - name 1:1 chats as the OTHER participant
 */

export const USER_IDENTITY = {
  displayName: 'Rajiv',
  // digits-only; we normalize sender strings similarly
  phoneNumbers: ['+919886031088', '9886031088'],
} as const;

export function normalizePhone(input: string): string {
  const digits = (input || '').replace(/\D/g, '');
  // If country code present (e.g. +91XXXXXXXXXX), take last 10 digits.
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

export function isMeSender(sender: string): boolean {
  const s = (sender || '').trim();
  if (!s) return false;

  if (s.toLowerCase() === USER_IDENTITY.displayName.toLowerCase()) return true;

  const senderPhone = normalizePhone(s);
  if (!senderPhone) return false;

  return USER_IDENTITY.phoneNumbers.some((p) => normalizePhone(p) === senderPhone);
}

