import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Users } from 'lucide-react';

interface UserProfile {
  user_id: string;
  full_name: string;
  role: 'admin' | 'supervisor' | 'employee';
  created_at: string;
}

interface SupervisorEmployee {
  id: string;
  supervisor_id: string;
  employee_id: string;
}

export default function UsersManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [supervisorEmployees, setSupervisorEmployees] = useState<SupervisorEmployee[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState<string | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const { toast } = useToast();
  const { hasRole } = useAuth();

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at');
    if (data) setUsers(data as UserProfile[]);
  };

  const fetchAssignments = async () => {
    const { data } = await supabase.from('supervisor_employees').select('*');
    if (data) setSupervisorEmployees(data);
  };

  useEffect(() => { fetchUsers(); fetchAssignments(); }, []);

  const updateRole = async (userId: string, newRole: 'admin' | 'supervisor' | 'employee') => {
    // Update profile role
    const { error: profileError } = await supabase.from('profiles').update({ role: newRole }).eq('user_id', userId);
    if (profileError) {
      toast({ title: 'Error', description: profileError.message, variant: 'destructive' });
      return;
    }

    // Update user_roles table (delete old roles, insert new one)
    await supabase.from('user_roles').delete().eq('user_id', userId);
    const { error: roleError } = await supabase.from('user_roles').insert({ user_id: userId, role: newRole });
    if (roleError) {
      toast({ title: 'Warning', description: 'Profile updated but role sync failed: ' + roleError.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Role Updated', description: `User role changed to ${newRole}` });
    fetchUsers();
  };

  const openAssignDialog = (supervisorId: string) => {
    const assigned = supervisorEmployees
      .filter(se => se.supervisor_id === supervisorId)
      .map(se => se.employee_id);
    setSelectedEmployees(assigned);
    setAssignDialogOpen(supervisorId);
  };

  const toggleEmployee = (empId: string) => {
    setSelectedEmployees(prev =>
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  const saveAssignments = async () => {
    if (!assignDialogOpen) return;
    const supervisorId = assignDialogOpen;

    // Delete existing assignments for this supervisor
    await supabase.from('supervisor_employees').delete().eq('supervisor_id', supervisorId);

    // Insert new assignments
    if (selectedEmployees.length > 0) {
      const rows = selectedEmployees.map(empId => ({
        supervisor_id: supervisorId,
        employee_id: empId,
      }));
      const { error } = await supabase.from('supervisor_employees').insert(rows);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
    }

    toast({ title: 'Assignments Saved' });
    setAssignDialogOpen(null);
    fetchAssignments();
  };

  const roleColor = (role: string) => {
    const map: Record<string, 'destructive' | 'warning' | 'secondary'> = { admin: 'destructive', supervisor: 'warning', employee: 'secondary' };
    return map[role] || 'secondary';
  };

  if (!hasRole('admin')) {
    return <div className="p-6 text-muted-foreground">Access denied. Admin only.</div>;
  }

  const employees = users.filter(u => u.role === 'employee');
  const getAssignedCount = (supervisorId: string) =>
    supervisorEmployees.filter(se => se.supervisor_id === supervisorId).length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground">Manage user roles and supervisor-employee assignments</p>
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
              <div className="flex items-center gap-3">
                {u.role === 'supervisor' && (
                  <Dialog open={assignDialogOpen === u.user_id} onOpenChange={(open) => open ? openAssignDialog(u.user_id) : setAssignDialogOpen(null)}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Users className="h-3.5 w-3.5 mr-1.5" />
                        Team ({getAssignedCount(u.user_id)})
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Assign Employees to {u.full_name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {employees.length === 0 && (
                          <p className="text-sm text-muted-foreground">No employees found.</p>
                        )}
                        {employees.map(emp => (
                          <label key={emp.user_id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer">
                            <Checkbox
                              checked={selectedEmployees.includes(emp.user_id)}
                              onCheckedChange={() => toggleEmployee(emp.user_id)}
                            />
                            <span className="text-sm font-medium">{emp.full_name}</span>
                          </label>
                        ))}
                      </div>
                      <Button onClick={saveAssignments} className="w-full">Save Assignments</Button>
                    </DialogContent>
                  </Dialog>
                )}
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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
