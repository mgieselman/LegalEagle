import { createBrowserRouter, Navigate } from 'react-router';
import { StaffLayout } from '@/layouts/StaffLayout';
import { ClientLayout } from '@/layouts/ClientLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { ClientLoginPage } from '@/pages/ClientLoginPage';
import { StaffDashboard } from '@/pages/staff/StaffDashboard';
import { StaffCaseShell } from '@/pages/staff/StaffCaseShell';
import { ClientList } from '@/pages/staff/ClientList';
import { ClientDetail } from '@/pages/staff/ClientDetail';
import { CreateClient } from '@/pages/staff/CreateClient';
import { AdminSettings } from '@/pages/admin/AdminSettings';
import { ClientDashboard } from '@/pages/client/ClientDashboard';
import { ClientCaseShell } from '@/pages/client/ClientCaseShell';
import { DocumentsTab } from '@/components/case/DocumentsTab';
import { DocumentReview } from '@/pages/staff/DocumentReview';

// Client step components
import { QuestionnaireStep } from '@/pages/client/steps/QuestionnaireStep';
import { ClientReviewStep } from '@/pages/client/steps/ClientReviewStep';

// Staff step components
import { IntakeStep } from '@/pages/staff/steps/IntakeStep';
import { ExtractionStep } from '@/pages/staff/steps/ExtractionStep';
import { MeansTestStep } from '@/pages/staff/steps/MeansTestStep';
import { StaffReviewStep } from '@/pages/staff/steps/StaffReviewStep';
import { PetitionStep } from '@/pages/staff/steps/PetitionStep';
import { FilingStep } from '@/pages/staff/steps/FilingStep';

export const router = createBrowserRouter([
  // Auth pages
  { path: '/login', element: <LoginPage /> },
  { path: '/client-login', element: <ClientLoginPage /> },

  // Staff routes
  {
    path: '/staff',
    element: (
      <ProtectedRoute>
        <StaffLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: 'dashboard', element: <StaffDashboard /> },
      {
        path: 'case/:id',
        element: <StaffCaseShell />,
        children: [
          { index: true, element: <Navigate to="intake" replace /> },
          { path: 'intake', element: <IntakeStep /> },
          { path: 'documents', element: <DocumentsTab /> },
          { path: 'extraction', element: <ExtractionStep /> },
          { path: 'extraction/:docId', element: <DocumentReview /> },
          { path: 'means-test', element: <MeansTestStep /> },
          { path: 'review', element: <StaffReviewStep /> },
          { path: 'petition', element: <PetitionStep /> },
          { path: 'filing', element: <FilingStep /> },
          // Redirects for old URLs
          { path: 'questionnaire', element: <Navigate to="../intake" replace /> },
          { path: 'documents/:docId', element: <Navigate to="../extraction/:docId" replace /> },
        ]
      },
      { path: 'clients', element: <ClientList /> },
      { path: 'clients/new', element: <CreateClient /> },
      { path: 'clients/:id', element: <ClientDetail /> },
      { index: true, element: <Navigate to="dashboard" replace /> },
    ],
  },

  // Client routes
  {
    path: '/client',
    element: (
      <ProtectedRoute>
        <ClientLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: 'dashboard', element: <ClientDashboard /> },
      {
        path: 'case/:id',
        element: <ClientCaseShell />,
        children: [
          { index: true, element: <Navigate to="documents" replace /> },
          { path: 'documents', element: <DocumentsTab /> },
          { path: 'questionnaire', element: <QuestionnaireStep /> },
          { path: 'review', element: <ClientReviewStep /> },
          // Redirects for old URLs
          { path: 'personal', element: <Navigate to="../questionnaire" replace /> },
          { path: 'income-employment', element: <Navigate to="../questionnaire" replace /> },
          { path: 'debts', element: <Navigate to="../questionnaire" replace /> },
          { path: 'assets', element: <Navigate to="../questionnaire" replace /> },
        ]
      },
      { index: true, element: <Navigate to="dashboard" replace /> },
    ],
  },

  // Admin routes (uses StaffLayout)
  {
    path: '/admin',
    element: (
      <ProtectedRoute>
        <StaffLayout />
      </ProtectedRoute>
    ),
    children: [{ path: 'settings', element: <AdminSettings /> }],
  },

  // Root redirect
  { path: '/', element: <Navigate to="/staff/dashboard" replace /> },
]);
