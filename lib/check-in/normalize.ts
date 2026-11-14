/**
 * Crockford base32 token normalization utilities (STORY-10, D-059).
 *
 * Booking tokens are 12-character Crockford base32 strings stored in
 * `reservations.booking_token`. This module normalizes raw user input
 * (manual text entry or QR scan payload) into the canonical form before
 * Zod validation or database submission.
 */

/**
 * Normalizes a raw booking token string to its canonical 12-character
 * Crockford base32 form (no separators).
 *
 * Steps (D-059):
 * 1. Drop every character that is not a letter or digit (spaces, hyphens, dashes, dots, etc.)
 * 2. Convert to uppercase.
 * 3. Map visually ambiguous characters: O/o → 0, I/i/L/l → 1.
 *
 * The result is returned as-is — length is not enforced here; Zod validates that.
 * This function is idempotent: normalizing an already-normalized token returns it unchanged.
 */
export function normalizeToken(raw: string): string {
  return raw
    .replace(/[^0-9a-zA-Z]/g, '')
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
}

/**
 * Formats a 12-character normalized Crockford base32 token for display.
 * Produces the grouped form `ABCD-EFGH-JKMN`.
 *
 * Does not validate the input; call after `normalizeToken` and Zod validation.
 */
export function formatToken(token: string): string {
  return `${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8, 12)}`
}
