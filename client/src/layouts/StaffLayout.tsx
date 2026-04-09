import { Outlet, NavLink } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import { LayoutDashboard, Users, Settings, LogOut } from 'lucide-react';

export function StaffLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold">LegalEagle</h1>
          <p className="text-sm text-muted-foreground truncate">
            {user?.name}
          </p>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          <NavLink
            to="/staff/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`
            }
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </NavLink>

          <NavLink
            to="/staff/clients"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`
            }
          >
            <Users className="h-4 w-4" />
            Clients
          </NavLink>

          {user && 'role' in user && user.role === 'admin' && (
            <NavLink
              to="/admin/settings"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                  isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`
              }
            >
              <Settings className="h-4 w-4" />
              Settings
            </NavLink>
          )}
        </nav>

        <div className="p-2 border-t">
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm w-full hover:bg-muted text-muted-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
