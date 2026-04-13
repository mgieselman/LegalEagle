/**
 * Shared utilities for rule-based extractors.
 */

/** Month name → zero-padded month number. Module-level to avoid per-call allocation. */
const MONTH_NAMES: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

// Pre-compiled date patterns
const RE_DATE_SLASH_4 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const RE_DATE_SLASH_2 = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/;
const RE_DATE_MONTH   = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/;
const RE_DATE_DASH    = /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/;

/**
 * Parse a dollar amount string into a number.
 * Handles: "$2,585.81", "2585.81", "(100.00)" (negative), "+3,615.08"
 */
export function parseDollar(s: string): number | null {
  const trimmed = s.trim();
  const negative = trimmed.startsWith('(') && trimmed.endsWith(')');
  const cleaned = trimmed.replace(/[$(),+\s]/g, '').replace(/,/g, '');
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return negative ? -n : n;
}

/**
 * Normalize a date string to ISO YYYY-MM-DD.
 * Handles: MM/DD/YYYY, MM/DD/YY, Month DD YYYY, MM-DD-YYYY, MM-DD-YY
 */
export function normalizeDate(dateStr: string): string | null {
  const s = dateStr.trim();

  // MM/DD/YYYY
  let m = RE_DATE_SLASH_4.exec(s);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;

  // MM/DD/YY
  m = RE_DATE_SLASH_2.exec(s);
  if (m) {
    const year = parseInt(m[3], 10) >= 50 ? '19' + m[3] : '20' + m[3];
    return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }

  // Month DD, YYYY
  m = RE_DATE_MONTH.exec(s);
  if (m) {
    const mo = MONTH_NAMES[m[1].toLowerCase()];
    if (mo) return `${m[3]}-${mo}-${m[2].padStart(2, '0')}`;
  }

  // MM-DD-YYYY or MM-DD-YY
  m = RE_DATE_DASH.exec(s);
  if (m) {
    const year = m[3].length === 2
      ? (parseInt(m[3], 10) >= 50 ? '19' + m[3] : '20' + m[3])
      : m[3];
    return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }

  return null;
}
