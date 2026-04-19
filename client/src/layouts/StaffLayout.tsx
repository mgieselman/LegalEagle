import { useEffect, useState } from 'react';
import { Outlet, NavLink } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SIDEBAR_COLLAPSED_KEY = 'staffLayoutSidebarCollapsed';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

export function StaffLayout() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  });

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  const items: NavItem[] = [
    { to: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/staff/clients', label: 'Clients', icon: Users },
  ];
  if (user && 'role' in user && user.role === 'admin') {
    items.push({ to: '/admin/settings', label: 'Settings', icon: Settings });
  }

  return (
    <div className="flex h-screen">
      <aside
        className={cn(
          'border-r bg-card flex flex-col transition-[width] duration-150',
          collapsed ? 'w-12' : 'w-64',
        )}
      >
        <div
          className={cn(
            'border-b flex items-center',
            collapsed ? 'justify-center p-2' : 'p-4 justify-between gap-2',
          )}
        >
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-lg font-bold">LegalEagle</h1>
              <p className="text-sm text-muted-foreground truncate">{user?.name}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            data-testid="staff-sidebar-collapse-toggle"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        <nav
          className={cn('flex-1 space-y-1', collapsed ? 'p-1 flex flex-col items-center' : 'p-2')}
          aria-label={collapsed ? 'Main navigation (collapsed)' : 'Main navigation'}
        >
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              aria-label={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-md text-sm transition-colors',
                  collapsed ? 'justify-center h-9 w-9' : 'gap-2 px-3 py-2',
                  isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

        <div className={cn('border-t', collapsed ? 'p-1 flex justify-center' : 'p-2')}>
          <button
            onClick={logout}
            title={collapsed ? 'Sign out' : undefined}
            aria-label={collapsed ? 'Sign out' : undefined}
            className={cn(
              'flex items-center rounded-md text-sm hover:bg-muted text-muted-foreground',
              collapsed ? 'justify-center h-9 w-9' : 'gap-2 px-3 py-2 w-full',
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && 'Sign out'}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
