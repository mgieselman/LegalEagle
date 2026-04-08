import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Select } from './ui/select';
import { ReviewPanel } from './ReviewPanel';
import { api, type FormSummary, type ReviewFinding } from '@/api/client';
import type { QuestionnaireData } from '@/types/questionnaire';
import { createEmptyQuestionnaire } from '@/types/questionnaire';
import { ChevronDown, ChevronRight, Plus, Save, Search, Download } from 'lucide-react';

import { Section1NameResidence } from './form-sections/Section1NameResidence';
import { Section2PriorBankruptcy } from './form-sections/Section2PriorBankruptcy';
import { Section3OccupationIncome } from './form-sections/Section3OccupationIncome';
import { Section4BusinessEmployment } from './form-sections/Section4BusinessEmployment';
import { Section5FinancialQuestions } from './form-sections/Section5FinancialQuestions';
import { Section6Taxes } from './form-sections/Section6Taxes';
import { Section7DebtsRepaid } from './form-sections/Section7DebtsRepaid';
import { Section8Suits } from './form-sections/Section8Suits';
import { Section9Garnishment } from './form-sections/Section9Garnishment';
import { Section10Repossessions } from './form-sections/Section10Repossessions';
import { Section11PropertyHeldByOthers } from './form-sections/Section11PropertyHeldByOthers';
import { Section12GiftsTransfers } from './form-sections/Section12GiftsTransfers';
import { Section13Losses } from './form-sections/Section13Losses';
import { Section14Attorneys } from './form-sections/Section14Attorneys';
import { Section15ClosedBankAccounts } from './form-sections/Section15ClosedBankAccounts';
import { Section16SafeDepositBoxes } from './form-sections/Section16SafeDepositBoxes';
import { Section17PropertyForOthers } from './form-sections/Section17PropertyForOthers';
import { Section18Leases } from './form-sections/Section18Leases';
import { Section19AlimonySupport } from './form-sections/Section19AlimonySupport';
import { Section20Accidents } from './form-sections/Section20Accidents';
import { Section21Cosigners } from './form-sections/Section21Cosigners';
import { Section22CreditCards } from './form-sections/Section22CreditCards';
import { Section23Evictions } from './form-sections/Section23Evictions';
import { Section24SecuredDebts } from './form-sections/Section24SecuredDebts';
import { Section25UnsecuredDebts } from './form-sections/Section25UnsecuredDebts';
import { Section26Assets } from './form-sections/Section26Assets';
import { Section27Vehicles } from './form-sections/Section27Vehicles';

const sections = [
  { key: '1', title: '1. Name & Residence Information', Component: Section1NameResidence },
  { key: '2', title: '2. Prior Bankruptcy', Component: Section2PriorBankruptcy },
  { key: '3', title: '3. Occupation & Income', Component: Section3OccupationIncome },
  { key: '4', title: '4. Business & Employment', Component: Section4BusinessEmployment },
  { key: '5', title: '5. Financial Questions', Component: Section5FinancialQuestions },
  { key: '6', title: '6. Taxes', Component: Section6Taxes },
  { key: '7', title: '7. Debts Repaid', Component: Section7DebtsRepaid },
  { key: '8', title: '8. Suits', Component: Section8Suits },
  { key: '9', title: '9. Garnishment & Sheriff\'s Sale', Component: Section9Garnishment },
  { key: '10', title: '10. Repossessions & Returns', Component: Section10Repossessions },
  { key: '11', title: '11. Property Held by Others', Component: Section11PropertyHeldByOthers },
  { key: '12', title: '12. Gifts & Transfers', Component: Section12GiftsTransfers },
  { key: '13', title: '13. Losses', Component: Section13Losses },
  { key: '14', title: '14. Attorneys & Consultants', Component: Section14Attorneys },
  { key: '15', title: '15. Closed Bank Accounts', Component: Section15ClosedBankAccounts },
  { key: '16', title: '16. Safe Deposit Boxes', Component: Section16SafeDepositBoxes },
  { key: '17', title: '17. Property Held for Others', Component: Section17PropertyForOthers },
  { key: '18', title: '18. Leases & Cooperatives', Component: Section18Leases },
  { key: '19', title: '19. Alimony, Child Support & Property Settlements', Component: Section19AlimonySupport },
  { key: '20', title: '20. Accidents & Driver\'s License', Component: Section20Accidents },
  { key: '21', title: '21. Cosigners & Debts for Others', Component: Section21Cosigners },
  { key: '22', title: '22. Credit Cards & Finance Company Debts', Component: Section22CreditCards },
  { key: '23', title: '23. Evictions', Component: Section23Evictions },
  { key: '24', title: '24. Secured Debts', Component: Section24SecuredDebts },
  { key: '25', title: '25. Unsecured Debts', Component: Section25UnsecuredDebts },
  { key: '26', title: '26. Asset Listing', Component: Section26Assets },
  { key: '27', title: '27. Vehicles', Component: Section27Vehicles },
];

export function FormShell() {
  const [formList, setFormList] = useState<FormSummary[]>([]);
  const [currentFormId, setCurrentFormId] = useState<string | null>(null);
  const [data, setData] = useState<QuestionnaireData>(createEmptyQuestionnaire());
  const [formName, setFormName] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['1']));
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [findings, setFindings] = useState<ReviewFinding[]>([]);
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadFormList = useCallback(async () => {
    try {
      const list = await api.listForms();
      setFormList(list);
    } catch {
      console.error('Failed to load forms');
    }
  }, []);

  useEffect(() => { loadFormList(); }, [loadFormList]);

  const handleSelectForm = async (id: string) => {
    if (!id) return;
    try {
      const form = await api.getForm(id);
      setCurrentFormId(id);
      setData(form.data as unknown as QuestionnaireData);
      setFormName(form.name);
    } catch {
      showToast('Failed to load form');
    }
  };

  const handleNewForm = () => {
    setCurrentFormId(null);
    setData(createEmptyQuestionnaire());
    setFormName('');
    setOpenSections(new Set(['1']));
    setFindings([]);
    setReviewOpen(false);
    setHighlightedSection(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const name = data.fullName || formName || 'Untitled';
      if (currentFormId) {
        await api.updateForm(currentFormId, name, data as unknown as Record<string, unknown>);
      } else {
        const result = await api.createForm(name, data as unknown as Record<string, unknown>);
        setCurrentFormId(result.id);
      }
      setFormName(name);
      await loadFormList();
      showToast('Form saved successfully');
    } catch {
      showToast('Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!currentFormId) {
      showToast('Save the form first before downloading');
      return;
    }
    // Save latest data before downloading
    try {
      const name = data.fullName || formName || 'Untitled';
      await api.updateForm(currentFormId, name, data as unknown as Record<string, unknown>);
    } catch {
      // continue with download anyway
    }
    api.downloadForm(currentFormId);
  };

  const handleReview = async () => {
    if (!currentFormId) {
      // Save first
      setSaving(true);
      try {
        const name = data.fullName || formName || 'Untitled';
        const result = await api.createForm(name, data as unknown as Record<string, unknown>);
        setCurrentFormId(result.id);
        setFormName(name);
        await loadFormList();
      } catch {
        showToast('Failed to save form before review');
        setSaving(false);
        return;
      }
      setSaving(false);
    } else {
      // Update before review
      try {
        const name = data.fullName || formName || 'Untitled';
        await api.updateForm(currentFormId, name, data as unknown as Record<string, unknown>);
      } catch {
        // continue with review anyway
      }
    }

    setReviewing(true);
    setReviewOpen(true);
    setFindings([]);
    try {
      const result = await api.reviewForm(currentFormId!);
      setFindings(result.findings);
    } catch {
      setFindings([{ severity: 'error', section: 'General', message: 'Failed to run AI review.' }]);
    } finally {
      setReviewing(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChange = (path: string, value: any) => {
    setData((prev) => {
      const next = { ...prev };
      const keys = path.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let obj: any = next;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Map AI finding section names to form section keys
  const sectionNameToKey = (sectionName: string): string | null => {
    const lower = sectionName.toLowerCase();
    const map: Record<string, string> = {
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
    for (const [keyword, key] of Object.entries(map)) {
      if (lower.includes(keyword)) return key;
    }
    // Also check the finding message for clues
    return null;
  };

  // Get section keys that have findings (for highlighting)
  const sectionFindingSeverity = (key: string): 'error' | 'warning' | 'info' | null => {
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
  };

  const handleFindingClick = (finding: ReviewFinding) => {
    const key = sectionNameToKey(finding.section) || sectionNameToKey(finding.message);
    if (key) {
      // Open the section
      setOpenSections((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      // Highlight and scroll
      setHighlightedSection(key);
      setTimeout(() => {
        const el = document.getElementById(`section-${key}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      // Clear highlight after a few seconds
      setTimeout(() => setHighlightedSection(null), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-background border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-bold mr-2">Bankruptcy Questionnaire</h1>
          <Select
            value={currentFormId || ''}
            onChange={(e) => handleSelectForm(e.target.value)}
            className="w-56"
          >
            <option value="">Select a form...</option>
            {formList.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({new Date(f.updated_at).toLocaleDateString()})
              </option>
            ))}
          </Select>
          <Button variant="outline" size="sm" onClick={handleNewForm} className="gap-1">
            <Plus className="h-4 w-4" /> New Form
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="gap-1">
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!currentFormId} className="gap-1">
            <Download className="h-4 w-4" /> Download
          </Button>
          <Button size="sm" onClick={handleReview} disabled={reviewing} className="gap-1">
            <Search className="h-4 w-4" /> {reviewing ? 'Reviewing...' : 'Review'}
          </Button>
        </div>
      </div>

      {/* Form sections */}
      <div className={`max-w-5xl mx-auto px-4 py-6 ${reviewOpen ? 'mr-[420px]' : ''}`}>
        <div className="space-y-2">
          {sections.map(({ key, title, Component }) => {
            const isOpen = openSections.has(key);
            const severity = sectionFindingSeverity(key);
            const isHighlighted = highlightedSection === key;
            const severityBorder = severity === 'error'
              ? 'border-red-400 border-2'
              : severity === 'warning'
              ? 'border-amber-400 border-2'
              : severity === 'info'
              ? 'border-blue-400 border-2'
              : 'border';
            const highlightClass = isHighlighted ? 'ring-2 ring-offset-2 ring-primary transition-all' : '';
            const severityDot = severity === 'error'
              ? 'bg-red-500'
              : severity === 'warning'
              ? 'bg-amber-500'
              : severity === 'info'
              ? 'bg-blue-500'
              : '';
            return (
              <div key={key} id={`section-${key}`} className={`rounded-lg ${severityBorder} ${highlightClass}`}>
                <button
                  className="w-full flex items-center gap-2 px-4 py-3 text-left font-medium hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => toggleSection(key)}
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  {title}
                  {severity && (
                    <span className={`ml-auto h-2.5 w-2.5 rounded-full ${severityDot} shrink-0`} />
                  )}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4">
                    <Component data={data} onChange={handleChange} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Review panel */}
      {reviewOpen && (
        <ReviewPanel
          findings={findings}
          loading={reviewing}
          onClose={() => { setReviewOpen(false); setHighlightedSection(null); }}
          onFindingClick={handleFindingClick}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-foreground text-background px-4 py-2 rounded-md shadow-lg text-sm z-50 animate-in fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
