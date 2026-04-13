import type { ReviewFinding } from '@/api/client';

/**
 * Maps keywords found in AI review finding section names to form section keys.
 * Hoisted to module scope so the object is created once, not per call.
 */
const SECTION_KEYWORD_MAP: Record<string, string> = {
  'name': '1', 'residence': '1', 'personal': '1', 'ssn': '1', 'address': '1',
  'prior bankruptcy': '2', 'bankruptcy': '2',
  'occupation': '3', 'income': '3', 'employment': '3',
  'business': '4',
  'financial': '5', 'welfare': '5', 'ira': '5', 'retirement': '5', 'trust': '5', 'inheritance': '5',
  'tax': '6', 'refund': '6',
  'debt': '7', 'repaid': '7', 'student loan': '7', 'insider': '7', 'preference': '7', 'payment': '7',
  'suit': '8', 'legal': '8', 'lawsuit': '8', 'criminal': '8',
  'foreclosure': '9', 'garnish': '9',
  'repossess': '10',
  'property held by': '11',
  'gift': '12', 'transfer': '12',
  'loss': '13', 'fire': '13', 'theft': '13', 'gambling': '13',
  'attorney': '14', 'consultant': '14', 'counseling': '14',
  'closed': '15', 'bank account': '15',
  'safe deposit': '16',
  'property held for': '17', 'property for other': '17',
  'lease': '18', 'cooperative': '18',
  'alimony': '19', 'child support': '19', 'marriage': '19',
  'accident': '20', 'driver': '20',
  'cosign': '21',
  'credit card': '22', 'cash advance': '22', 'credit': '22', 'finance': '22', 'payday': '22',
  'eviction': '23', 'landlord': '23',
  'secured debt': '24', 'secured': '24',
  'unsecured': '25', 'creditor': '25',
  'asset': '26', 'cash on hand': '26', 'property': '26', 'household': '26',
  'vehicle': '27', 'car': '27', 'auto': '27',
};

/**
 * Maps an AI review finding's section name to a form section key
 * by matching keywords against known section topics.
 */
export function sectionNameToKey(sectionName: string): string | null {
  const lower = sectionName.toLowerCase();
  for (const [keyword, key] of Object.entries(SECTION_KEYWORD_MAP)) {
    if (lower.includes(keyword)) return key;
  }
  return null;
}

/**
 * Compute the worst severity among findings that map to a given section key.
 */
export function sectionFindingSeverity(
  key: string,
  findings: ReviewFinding[],
): 'error' | 'warning' | 'info' | null {
  let worst: 'error' | 'warning' | 'info' | null = null;
  for (const f of findings) {
    const mappedKey = sectionNameToKey(f.section) || sectionNameToKey(f.message);
    if (mappedKey === key) {
      if (f.severity === 'error') return 'error';
      if (f.severity === 'warning') worst = worst === 'error' ? 'error' : 'warning';
      if (f.severity === 'info' && !worst) worst = 'info';
    }
  }
  return worst;
}
