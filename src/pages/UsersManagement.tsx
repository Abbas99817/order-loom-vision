import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface UserProfile {
  user_id: string;
  full_name: string;
  role: 'admin' | 'supervisor' | 'employee';
  created_at: string;
}

export default function UsersManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const { toast } = useToast();
  const { hasRole } = useAuth();

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at');
    if (data) setUsers(data as UserProfile[]);
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateRole = async (userId: string, newRole: 'admin' | 'supervisor' | 'employee') => {
    // Update profile role
    const { error: profileError } = await supabase.from('profiles').update({ role: newRole }).eq('user_id', userId);
    
    if (profileError) {
      toast({ title: 'Error', description: profileError.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Role Updated', description: `User role changed to ${newRole}` });
    fetchUsers();
  };

  const roleColor = (role: string) => {
    const map: Record<string, 'destructive' | 'warning' | 'info'> = { admin: 'destructive', supervisor: 'warning', employee: 'info' };
    return map[role] || 'info';
  };

  if (!hasRole('admin')) {
    return <div className="p-6 text-muted-foreground">Access denied. Admin only.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground">Manage user roles and access</p>
      </div>

      <div className="space-y-3">
        {users.map(u => (
          <Card key={u.user_id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  {u.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{u.full_name}</p>
                  <p className="text-xs text-muted-foreground">Joined {new Date(u.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <Select value={u.role} onValueChange={(val) => updateRole(u.user_id, val as any)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
