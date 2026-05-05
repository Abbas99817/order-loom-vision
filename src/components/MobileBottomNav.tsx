import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, ListChecks, Package, BarChart3, Users, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

const navItems = [
  { label: 'Home', icon: LayoutDashboard, path: '/', roles: ['admin', 'supervisor'] as const },
  { label: 'Orders', icon: ClipboardList, path: '/work-orders', roles: ['admin', 'supervisor'] as const },
  { label: 'Tasks', icon: ListChecks, path: '/my-tasks', roles: ['employee', 'supervisor'] as const },
  { label: 'Team', icon: BarChart3, path: '/employee-performance', roles: ['admin', 'supervisor'] as const },
];

const moreItems = [
  { label: 'Products', icon: Package, path: '/products', roles: ['admin', 'supervisor'] as const },
  { label: 'Users', icon: Users, path: '/users', roles: ['admin'] as const },
];

export default function MobileBottomNav() {
  const { hasRole, signOut, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const visible = navItems.filter(i => i.roles.some(r => hasRole(r)));
  const moreVisible = moreItems.filter(i => i.roles.some(r => hasRole(r)));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16">
        {visible.map(item => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 h-full transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', active && 'scale-110')} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
        <Sheet>
          <SheetTrigger asChild>
            <button className="flex flex-1 flex-col items-center justify-center gap-1 h-full text-muted-foreground">
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <div className="py-4 space-y-1">
              <div className="px-2 pb-3 mb-2 border-b">
                <p className="font-semibold">{profile?.full_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
              </div>
              {moreVisible.map(item => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex w-full items-center gap-3 rounded-lg p-3 text-sm hover:bg-accent"
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              ))}
              <Button variant="ghost" onClick={signOut} className="w-full justify-start gap-3 text-destructive hover:text-destructive">
                <LogOut className="h-5 w-5" />
                Sign out
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
