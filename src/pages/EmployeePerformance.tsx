import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar,
} from 'recharts';
import { Users, TrendingUp, Award, Target } from 'lucide-react';

interface EmployeeStat {
  name: string;
  userId: string;
  assignedSteps: number;
  completedUnits: number;
  assignedUnits: number;
  completionRate: number;
  activeWOs: number;
}

const COLORS = [
  'hsl(215, 70%, 50%)', 'hsl(142, 60%, 40%)', 'hsl(38, 92%, 50%)',
  'hsl(174, 60%, 40%)', 'hsl(0, 72%, 51%)', 'hsl(270, 60%, 50%)',
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-popover p-3 shadow-xl">
      <p className="font-semibold text-sm text-popover-foreground mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs py-0.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-popover-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function EmployeePerformance() {
  const [employees, setEmployees] = useState<EmployeeStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [stepsRes, profilesRes, woRes] = await Promise.all([
        supabase.from('process_steps').select('*'),
        supabase.from('profiles').select('user_id, full_name, role'),
        supabase.from('work_orders').select('id, status'),
      ]);

      const steps = stepsRes.data || [];
      const profiles = profilesRes.data || [];
      const workOrders = woRes.data || [];

      const employeeProfiles = profiles.filter(p => p.role === 'employee' || p.role === 'supervisor');
      const empStats: EmployeeStat[] = employeeProfiles.map(p => {
        const empSteps = steps.filter(s => s.assigned_to === p.user_id);
        const assignedUnits = empSteps.reduce((s, st) => s + st.assigned_quantity, 0);
        const completedUnits = empSteps.reduce((s, st) => s + st.completed_quantity, 0);
        const woIds = new Set(empSteps.map(s => s.work_order_id));
        const activeWOs = workOrders.filter(wo => woIds.has(wo.id) && wo.status !== 'completed').length;

        return {
          name: p.full_name || 'Unknown',
          userId: p.user_id,
          assignedSteps: empSteps.length,
          assignedUnits,
          completedUnits,
          completionRate: assignedUnits > 0 ? Math.round((completedUnits / assignedUnits) * 100) : 0,
          activeWOs,
        };
      }).filter(e => e.assignedSteps > 0).sort((a, b) => b.completedUnits - a.completedUnits);

      setEmployees(empStats);
      setLoading(false);
    };
    fetchData();
  }, []);

  const totalAssigned = employees.reduce((s, e) => s + e.assignedUnits, 0);
  const totalCompleted = employees.reduce((s, e) => s + e.completedUnits, 0);
  const avgRate = employees.length > 0 ? Math.round(employees.reduce((s, e) => s + e.completionRate, 0) / employees.length) : 0;
  const topPerformer = employees[0];

  const summaryCards = [
    { label: 'Total Employees', value: employees.length, icon: Users, color: 'text-primary' },
    { label: 'Total Units Assigned', value: totalAssigned, icon: Target, color: 'text-info' },
    { label: 'Total Units Completed', value: totalCompleted, icon: TrendingUp, color: 'text-success' },
    { label: 'Avg Completion Rate', value: `${avgRate}%`, icon: Award, color: 'text-warning' },
  ];

  const pieData = employees.slice(0, 6).map(e => ({ name: e.name, value: e.completedUnits }));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Employee Performance</h1>
        <p className="text-muted-foreground">Detailed productivity and contribution analytics</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <Card key={card.label} className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold mt-1 text-foreground">{card.value}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <card.icon className={`h-6 w-6 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {employees.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No employee data yet. Assign tasks to employees to see their performance here.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart - Units per Employee */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Units Completed vs Assigned</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(280, employees.length * 55)}>
                  <BarChart data={employees} layout="vertical" barGap={4} margin={{ left: 10, right: 20 }}>
                    <defs>
                      <linearGradient id="completedGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(142, 60%, 45%)" />
                        <stop offset="100%" stopColor="hsl(142, 60%, 35%)" />
                      </linearGradient>
                      <linearGradient id="assignedGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(215, 70%, 55%)" />
                        <stop offset="100%" stopColor="hsl(215, 70%, 40%)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="completedUnits" name="Completed" fill="url(#completedGrad)" radius={[0, 6, 6, 0]} barSize={16} />
                    <Bar dataKey="assignedUnits" name="Assigned" fill="url(#assignedGrad)" radius={[0, 6, 6, 0]} barSize={16} opacity={0.5} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie Chart - Contribution Share */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Contribution Share</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      strokeWidth={3}
                      stroke="hsl(var(--background))"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Employee Detail Cards */}
          <div>
            <h2 className="text-xl font-bold text-foreground mb-4">Individual Performance</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map((emp, idx) => (
                <Card key={emp.userId} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-primary-foreground"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      >
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{emp.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {emp.assignedSteps} step{emp.assignedSteps !== 1 ? 's' : ''} · {emp.activeWOs} active WO{emp.activeWOs !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <Badge
                        variant={emp.completionRate >= 80 ? 'success' : emp.completionRate >= 50 ? 'warning' : 'default'}
                        className="text-xs"
                      >
                        {emp.completionRate}%
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium text-foreground">{emp.completedUnits} / {emp.assignedUnits} units</span>
                      </div>
                      <Progress value={emp.completionRate} className="h-2.5" />
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                        <p className="text-lg font-bold text-foreground">{emp.assignedUnits}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Assigned</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                        <p className="text-lg font-bold text-success">{emp.completedUnits}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Done</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                        <p className="text-lg font-bold text-warning">{emp.assignedUnits - emp.completedUnits}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
