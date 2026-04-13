import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';

interface Tab {
  label: string;
  to: string; // relative path
}

interface TabBarProps {
  tabs: Tab[];
}

export function TabBar({ tabs }: TabBarProps) {
  return (
    <div className="border-b">
      <nav className="px-6">
        <div className="flex overflow-x-auto gap-1 scrollbar-none">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === ''}
              className={({ isActive }) =>
                cn(
                  'px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap border-b-2 border-transparent',
                  isActive && 'border-primary text-foreground'
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}