import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';

interface ClientCase {
  id: string;
  chapter: string;
  status: string;
  filingDate: string | null;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  intake: 'Getting Started',
  documents: 'Documents Needed',
  review: 'Under Review',
  ready_to_file: 'Ready to File',
  filed: 'Filed',
  discharged: 'Discharged',
  dismissed: 'Dismissed',
  closed: 'Closed',
};

export function ClientDashboard() {
  const { user } = useAuth();
  const [cases, setCases] = useState<ClientCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .clientListCases()
      .then(setCases)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading your cases...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Welcome, {user?.name}</h2>
        <p className="text-muted-foreground mt-1">
          Here are your bankruptcy cases. Click on a case to fill out your questionnaire.
        </p>
      </div>

      {cases.length === 0 ? (
        <div className="border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">No cases found. Please contact your attorney.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cases.map((c) => (
            <Link
              key={c.id}
              to={`/client/case/${c.id}`}
              className="block border rounded-lg p-4 hover:border-primary hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Chapter {c.chapter} Bankruptcy</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Status: {statusLabels[c.status] || c.status}
                  </p>
                </div>
                <span className="text-sm text-primary">
                  {c.status === 'intake' || c.status === 'documents'
                    ? 'Continue →'
                    : 'View →'}
                </span>
              </div>
              {c.filingDate && (
                <p className="text-xs text-muted-foreground mt-2">
                  Filed: {new Date(c.filingDate).toLocaleDateString()}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
