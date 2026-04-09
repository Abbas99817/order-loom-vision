import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, LogOut, Factory, Users, ListChecks, Package, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ['admin', 'supervisor'] as const },
  { label: 'Work Orders', icon: ClipboardList, path: '/work-orders', roles: ['admin', 'supervisor'] as const },
  { label: 'Products', icon: Package, path: '/products', roles: ['admin', 'supervisor'] as const },
  { label: 'Employees', icon: BarChart3, path: '/employee-performance', roles: ['admin', 'supervisor'] as const },
  { label: 'My Tasks', icon: ListChecks, path: '/my-tasks', roles: ['employee', 'supervisor'] as const },
  { label: 'Users', icon: Users, path: '/users', roles: ['admin'] as const },
];

export default function AppSidebar() {
  const { profile, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const roleColor = {
    admin: 'destructive' as const,
    supervisor: 'warning' as const,
    employee: 'info' as const,
  };

  const visibleItems = navItems.filter(item =>
    item.roles.some(role => hasRole(role))
  );

  return (
    <aside className={cn(
      'flex h-screen flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300',
      collapsed ? 'w-[68px]' : 'w-64'
    )}>
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b border-sidebar-border transition-all',
        collapsed ? 'justify-center px-2 py-4' : 'gap-3 px-5 py-5'
      )}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
          <Factory className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-sidebar-foreground leading-tight">Production Mgr</h1>
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">Manufacturing</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {!collapsed && (
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">Menu</p>
        )}
        {visibleItems.map(item => {
          const active = location.pathname === item.path;
          const button = (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex w-full items-center rounded-lg text-sm font-medium transition-all duration-200',
                collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-sidebar-primary')} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
              </Tooltip>
            );
          }
          return button;
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="px-2 pb-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg p-2 text-sidebar-foreground/40 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* User */}
      <div className={cn(
        'border-t border-sidebar-border',
        collapsed ? 'p-2' : 'p-4'
      )}>
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="flex justify-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-xs font-bold text-sidebar-accent-foreground">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {profile?.full_name} ({profile?.role})
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-bold text-sidebar-accent-foreground">
              {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-sidebar-foreground">{profile?.full_name}</p>
              <Badge variant={roleColor[profile?.role || 'employee']} className="text-[10px] px-1.5 py-0">
                {profile?.role}
              </Badge>
            </div>
          </div>
        )}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={signOut}
              className={cn(
                'flex w-full items-center rounded-lg text-sm text-sidebar-foreground/50 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground transition-colors',
                collapsed ? 'justify-center p-2.5' : 'gap-2 px-3 py-2'
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sign out</span>}
            </button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right" className="text-xs">Sign out</TooltipContent>}
        </Tooltip>
      </div>
    </aside>
  );
}
