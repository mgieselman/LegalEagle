import { createBrowserRouter, Navigate } from 'react-router';
import { StaffLayout } from '@/layouts/StaffLayout';
import { ClientLayout } from '@/layouts/ClientLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { ClientLoginPage } from '@/pages/ClientLoginPage';
import { StaffDashboard } from '@/pages/staff/StaffDashboard';
import { StaffCaseView } from '@/pages/staff/StaffCaseView';
import { ClientList } from '@/pages/staff/ClientList';
import { CreateClient } from '@/pages/staff/CreateClient';
import { AdminSettings } from '@/pages/admin/AdminSettings';
import { ClientDashboard } from '@/pages/client/ClientDashboard';
import { ClientCaseView } from '@/pages/client/ClientCaseView';

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
      { path: 'case/:id', element: <StaffCaseView /> },
      { path: 'clients', element: <ClientList /> },
      { path: 'clients/new', element: <CreateClient /> },
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
      { path: 'case/:id', element: <ClientCaseView /> },
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
