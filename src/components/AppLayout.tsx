import { ReactNode } from 'react';
import AppSidebar from './AppSidebar';
import MobileBottomNav from './MobileBottomNav';
import { Factory } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <AppSidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b bg-background px-4 h-14 md:hidden pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <Factory className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            <span className="text-sm font-bold">Production Mgr</span>
          </div>
          {profile && (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-bold text-sidebar-accent-foreground">
              {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
        </header>
        <main className="flex-1 overflow-auto bg-background overscroll-contain">
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </div>
  );
}
