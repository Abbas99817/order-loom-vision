import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { ClipboardList, CheckCircle2, Clock, TrendingUp, Users } from 'lucide-react';

interface Stats {
  totalWO: number;
  openWO: number;
  inProgressWO: number;
  completedWO: number;
  totalQuantity: number;
  completedQuantity: number;
}

interface ProductStat {
  name: string;
  total: number;
  open: number;
  inProgress: number;
  completed: number;
}

interface EmployeeStat {
  name: string;
  userId: string;
  assignedSteps: number;
  completedUnits: number;
  assignedUnits: number;
  completionRate: number;
}

const PIE_COLORS = ['hsl(215, 70%, 40%)', 'hsl(38, 92%, 50%)', 'hsl(142, 60%, 40%)'];
const PRODUCT_COLORS = {
  open: 'hsl(215, 70%, 50%)',
  inProgress: 'hsl(38, 85%, 50%)',
  completed: 'hsl(142, 60%, 40%)',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover p-3 shadow-lg">
      <p className="font-semibold text-sm text-popover-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-popover-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ totalWO: 0, openWO: 0, inProgressWO: 0, completedWO: 0, totalQuantity: 0, completedQuantity: 0 });
  const [recentWOs, setRecentWOs] = useState<any[]>([]);
  const [productStats, setProductStats] = useState<ProductStat[]>([]);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStat[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [woRes, stepsRes, productsRes, profilesRes] = await Promise.all([
        supabase.from('work_orders').select('*'),
        supabase.from('process_steps').select('*'),
        supabase.from('products').select('id, name'),
        supabase.from('profiles').select('user_id, full_name, role'),
      ]);

      const workOrders = woRes.data || [];
      const steps = stepsRes.data || [];
      const products = productsRes.data || [];
      const profiles = profilesRes.data || [];

      // Basic stats
      const open = workOrders.filter(w => w.status === 'open').length;
      const inProg = workOrders.filter(w => w.status === 'in_progress').length;
      const completed = workOrders.filter(w => w.status === 'completed').length;
      const totalQty = workOrders.reduce((s, w) => s + w.total_quantity, 0);
      const completedQty = steps.reduce((s, st) => s + st.completed_quantity, 0);

      setStats({ totalWO: workOrders.length, openWO: open, inProgressWO: inProg, completedWO: completed, totalQuantity: totalQty, completedQuantity: completedQty });
      setRecentWOs(workOrders.slice(-5).reverse());

      // Product stats with status breakdown
      const productMap = new Map(products.map(p => [p.id, p.name]));
      const pStats: Record<string, ProductStat> = {};
      workOrders.forEach(wo => {
        const pName = wo.product_id ? (productMap.get(wo.product_id) || 'Unknown') : 'Unassigned';
        if (!pStats[pName]) pStats[pName] = { name: pName, total: 0, open: 0, inProgress: 0, completed: 0 };
        pStats[pName].total++;
        if (wo.status === 'open') pStats[pName].open++;
        else if (wo.status === 'in_progress') pStats[pName].inProgress++;
        else if (wo.status === 'completed') pStats[pName].completed++;
      });
      setProductStats(Object.values(pStats).sort((a, b) => b.total - a.total));

      // Employee stats
      const employeeProfiles = profiles.filter(p => p.role === 'employee' || p.role === 'supervisor');
      const empStats: EmployeeStat[] = employeeProfiles.map(p => {
        const empSteps = steps.filter(s => s.assigned_to === p.user_id);
        const assignedUnits = empSteps.reduce((s, st) => s + st.assigned_quantity, 0);
        const completedUnits = empSteps.reduce((s, st) => s + st.completed_quantity, 0);
        return {
          name: p.full_name || 'Unknown',
          userId: p.user_id,
          assignedSteps: empSteps.length,
          assignedUnits,
          completedUnits,
          completionRate: assignedUnits > 0 ? Math.round((completedUnits / assignedUnits) * 100) : 0,
        };
      }).filter(e => e.assignedSteps > 0).sort((a, b) => b.completedUnits - a.completedUnits);
      setEmployeeStats(empStats);
    };
    fetchData();
  }, []);

  const woStatusData = [
    { name: 'Open', value: stats.openWO },
    { name: 'In Progress', value: stats.inProgressWO },
    { name: 'Completed', value: stats.completedWO },
  ].filter(d => d.value > 0);

  const statusBadge = (status: string) => {
    const map: Record<string, 'default' | 'warning' | 'success'> = { open: 'default', in_progress: 'warning', completed: 'success' };
    return <Badge variant={map[status] || 'default'}>{status.replace('_', ' ')}</Badge>;
  };

  const statCards = [
    { label: 'Total Work Orders', value: stats.totalWO, icon: ClipboardList, color: 'text-primary' },
    { label: 'In Progress', value: stats.inProgressWO, icon: Clock, color: 'text-warning' },
    { label: 'Completed', value: stats.completedWO, icon: CheckCircle2, color: 'text-success' },
    { label: 'Production Rate', value: stats.totalQuantity > 0 ? `${Math.round((stats.completedQuantity / stats.totalQuantity) * 100)}%` : '0%', icon: TrendingUp, color: 'text-accent' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Production overview and analytics</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <Card key={card.label} className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold mt-1 text-foreground">{card.value}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <card.icon className={cn('h-6 w-6', card.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Work Order Status</CardTitle>
          </CardHeader>
          <CardContent>
            {woStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={woStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} dataKey="value" strokeWidth={2} stroke="hsl(var(--background))" label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                    {woStatusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">No data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Work Orders by Product - Stacked Bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Work Orders by Product</CardTitle>
          </CardHeader>
          <CardContent>
            {productStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={productStats} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="open" name="Open" stackId="a" fill={PRODUCT_COLORS.open} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="inProgress" name="In Progress" stackId="a" fill={PRODUCT_COLORS.inProgress} />
                  <Bar dataKey="completed" name="Completed" stackId="a" fill={PRODUCT_COLORS.completed} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">No product data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Employee Performance Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Employee Performance</h2>
            <p className="text-sm text-muted-foreground">Individual contribution and productivity overview</p>
          </div>
        </div>

        {employeeStats.length > 0 ? (
          <>
            {/* Employee Bar Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Units Completed per Employee</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(250, employeeStats.length * 50)}>
                  <BarChart data={employeeStats} layout="vertical" barSize={24} margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="completedUnits" name="Completed" fill="hsl(142, 60%, 40%)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="assignedUnits" name="Assigned" fill="hsl(215, 70%, 50%)" radius={[0, 4, 4, 0]} opacity={0.4} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Employee Detail Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {employeeStats.map(emp => (
                <Card key={emp.userId} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{emp.name}</p>
                        <p className="text-xs text-muted-foreground">{emp.assignedSteps} active step{emp.assignedSteps !== 1 ? 's' : ''}</p>
                      </div>
                      <Badge variant={emp.completionRate >= 80 ? 'success' : emp.completionRate >= 50 ? 'warning' : 'default'} className="text-xs">
                        {emp.completionRate}%
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium text-foreground">{emp.completedUnits} / {emp.assignedUnits} units</span>
                      </div>
                      <Progress value={emp.completionRate} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                        <p className="text-lg font-bold text-foreground">{emp.assignedUnits}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Assigned</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                        <p className="text-lg font-bold text-success">{emp.completedUnits}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Completed</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No employee data yet. Assign tasks to employees to see their performance here.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Work Orders */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Recent Work Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {recentWOs.length > 0 ? (
            <div className="space-y-3">
              {recentWOs.map(wo => (
                <div key={wo.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <span className="font-medium text-foreground">{wo.wo_number}</span>
                    <span className="text-muted-foreground ml-2 text-sm">{wo.description}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{wo.total_quantity} units</span>
                    {statusBadge(wo.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No work orders yet. Create one to get started!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
