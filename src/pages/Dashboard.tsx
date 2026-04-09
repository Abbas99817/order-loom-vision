import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { ClipboardList, CheckCircle2, Clock, TrendingUp, Download, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { exportToCSV, exportToPDF } from '@/lib/exportUtils';

interface Stats {
  totalWO: number;
  openWO: number;
  inProgressWO: number;
  completedWO: number;
  totalQuantity: number;
  completedQuantity: number;
}

interface ProductStat {
  id: string;
  name: string;
  total: number;
  open: number;
  inProgress: number;
  completed: number;
}

interface RecentActivity {
  id: string;
  type: 'progress' | 'wo_created' | 'step_added';
  description: string;
  user: string;
  timestamp: string;
  meta?: string;
}

const PIE_COLORS = ['hsl(215, 70%, 50%)', 'hsl(38, 92%, 50%)', 'hsl(142, 60%, 40%)'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-popover p-3 shadow-xl backdrop-blur-sm">
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

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ totalWO: 0, openWO: 0, inProgressWO: 0, completedWO: 0, totalQuantity: 0, completedQuantity: 0 });
  const [recentWOs, setRecentWOs] = useState<any[]>([]);
  const [productStats, setProductStats] = useState<ProductStat[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [woRes, stepsRes, productsRes, logsRes, profilesRes] = await Promise.all([
        supabase.from('work_orders').select('*'),
        supabase.from('process_steps').select('*'),
        supabase.from('products').select('id, name'),
        supabase.from('progress_logs').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('profiles').select('user_id, full_name'),
      ]);

      const workOrders = woRes.data || [];
      const steps = stepsRes.data || [];
      const products = productsRes.data || [];
      const logs = logsRes.data || [];
      const profiles = profilesRes.data || [];

      const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name]));
      const stepMap = new Map(steps.map(s => [s.id, s]));
      const woMap = new Map(workOrders.map(w => [w.id, w]));

      const open = workOrders.filter(w => w.status === 'open').length;
      const inProg = workOrders.filter(w => w.status === 'in_progress').length;
      const completed = workOrders.filter(w => w.status === 'completed').length;
      const totalQty = workOrders.reduce((s, w) => s + w.total_quantity, 0);
      const completedQty = steps.reduce((s, st) => s + st.completed_quantity, 0);

      setStats({ totalWO: workOrders.length, openWO: open, inProgressWO: inProg, completedWO: completed, totalQuantity: totalQty, completedQuantity: completedQty });
      setRecentWOs(workOrders.slice(-5).reverse());

      // Product stats
      const productMap = new Map(products.map(p => [p.id, p.name]));
      const pStats: Record<string, ProductStat> = {};
      workOrders.forEach(wo => {
        const pId = wo.product_id || 'unassigned';
        const pName = wo.product_id ? (productMap.get(wo.product_id) || 'Unknown') : 'Unassigned';
        if (!pStats[pId]) pStats[pId] = { id: pId, name: pName, total: 0, open: 0, inProgress: 0, completed: 0 };
        pStats[pId].total++;
        if (wo.status === 'open') pStats[pId].open++;
        else if (wo.status === 'in_progress') pStats[pId].inProgress++;
        else if (wo.status === 'completed') pStats[pId].completed++;
      });
      setProductStats(Object.values(pStats).sort((a, b) => b.total - a.total));

      // Recent activity from progress logs
      const activities: RecentActivity[] = logs.map(log => {
        const step = stepMap.get(log.process_step_id);
        const wo = step ? woMap.get(step.work_order_id) : null;
        return {
          id: log.id,
          type: 'progress' as const,
          description: `Completed ${log.quantity_completed} units on "${step?.step_name || 'Unknown step'}"`,
          user: profileMap.get(log.updated_by) || 'Unknown',
          timestamp: log.created_at,
          meta: wo?.wo_number || '',
        };
      });
      setRecentActivity(activities.slice(0, 10));
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

  const handleBarClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload?.id && data.activePayload[0].payload.id !== 'unassigned') {
      navigate(`/products/${data.activePayload[0].payload.id}`);
    }
  };

  const exportDashboard = (format: 'csv' | 'pdf') => {
    const headers = ['Product', 'Total WOs', 'Open', 'In Progress', 'Completed'];
    const rows = productStats.map(p => [p.name, p.total, p.open, p.inProgress, p.completed]);
    const summary = [
      { label: 'Total Work Orders', value: stats.totalWO },
      { label: 'Open', value: stats.openWO },
      { label: 'In Progress', value: stats.inProgressWO },
      { label: 'Completed', value: stats.completedWO },
      { label: 'Production Rate', value: stats.totalQuantity > 0 ? `${Math.round((stats.completedQuantity / stats.totalQuantity) * 100)}%` : '0%' },
    ];
    if (format === 'csv') exportToCSV('dashboard-report', headers, rows);
    else exportToPDF('dashboard-report', 'Dashboard Report', headers, rows, summary);
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Production overview and analytics</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => exportDashboard('csv')}>Export as CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportDashboard('pdf')}>Export as PDF</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
                  <card.icon className={`h-6 w-6 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Work Order Status</CardTitle>
          </CardHeader>
          <CardContent>
            {woStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={woStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    dataKey="value"
                    strokeWidth={3}
                    stroke="hsl(var(--background))"
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {woStatusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">No data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Stacked Bar - Clickable */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">
              Work Orders by Product
              <span className="text-xs font-normal text-muted-foreground ml-2">(click bar for details)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={productStats} barSize={36} onClick={handleBarClick} className="cursor-pointer">
                  <defs>
                    <linearGradient id="openGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(215, 70%, 55%)" />
                      <stop offset="100%" stopColor="hsl(215, 70%, 40%)" />
                    </linearGradient>
                    <linearGradient id="inProgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(38, 92%, 55%)" />
                      <stop offset="100%" stopColor="hsl(38, 85%, 42%)" />
                    </linearGradient>
                    <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142, 60%, 48%)" />
                      <stop offset="100%" stopColor="hsl(142, 60%, 35%)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="open" name="Open" stackId="a" fill="url(#openGrad)" />
                  <Bar dataKey="inProgress" name="In Progress" stackId="a" fill="url(#inProgGrad)" />
                  <Bar dataKey="completed" name="Completed" stackId="a" fill="url(#compGrad)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">No product data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity + Recent Work Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-1">
                {recentActivity.map(act => (
                  <div key={act.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-snug">
                        <span className="font-medium">{act.user}</span>{' '}
                        <span className="text-muted-foreground">{act.description}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {act.meta && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{act.meta}</Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground">{formatTimeAgo(act.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">No activity yet</div>
            )}
          </CardContent>
        </Card>

        {/* Recent Work Orders */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Recent Work Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {recentWOs.length > 0 ? (
              <div className="space-y-2">
                {recentWOs.map(wo => (
                  <div
                    key={wo.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 cursor-pointer transition-colors"
                    onClick={() => navigate(`/work-orders/${wo.id}`)}
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-foreground">{wo.wo_number}</span>
                      <p className="text-muted-foreground text-sm truncate">{wo.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="text-sm text-muted-foreground">{wo.total_quantity} units</span>
                      {statusBadge(wo.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No work orders yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
