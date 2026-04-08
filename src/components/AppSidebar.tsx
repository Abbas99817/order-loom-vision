import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Settings, LogOut, Factory, Users, ListChecks, Package, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ['admin', 'supervisor'] as const },
  { label: 'Work Orders', icon: ClipboardList, path: '/work-orders', roles: ['admin', 'supervisor'] as const },
  { label: 'Products', icon: Package, path: '/products', roles: ['admin', 'supervisor'] as const },
  { label: 'My Tasks', icon: ListChecks, path: '/my-tasks', roles: ['employee', 'supervisor'] as const },
  { label: 'Users', icon: Users, path: '/users', roles: ['admin'] as const },
];

export default function AppSidebar() {
  const { profile, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const roleColor = {
    admin: 'destructive' as const,
    supervisor: 'warning' as const,
    employee: 'info' as const,
  };

  const visibleItems = navItems.filter(item =>
    item.roles.some(role => hasRole(role))
  );

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
          <Factory className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-sidebar-foreground">Production Mgr</h1>
          <p className="text-xs text-sidebar-foreground/60">Manufacturing</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map(item => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-bold text-sidebar-accent-foreground">
            {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-sidebar-foreground">{profile?.full_name}</p>
            <Badge variant={roleColor[profile?.role || 'employee']} className="text-[10px] px-1.5 py-0">
              {profile?.role}
            </Badge>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
