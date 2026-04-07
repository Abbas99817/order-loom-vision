import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ClipboardList, CheckCircle2, Clock, TrendingUp } from 'lucide-react';

interface Stats {
  totalWO: number;
  openWO: number;
  inProgressWO: number;
  completedWO: number;
  totalSteps: number;
  completedSteps: number;
  totalQuantity: number;
  completedQuantity: number;
}

interface ProductStat {
  name: string;
  count: number;
}

const PIE_COLORS = ['hsl(215, 70%, 28%)', 'hsl(38, 92%, 50%)', 'hsl(142, 60%, 40%)'];
const BAR_COLORS = ['hsl(174, 60%, 40%)', 'hsl(215, 70%, 50%)', 'hsl(38, 80%, 50%)', 'hsl(340, 60%, 50%)', 'hsl(142, 50%, 45%)'];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ totalWO: 0, openWO: 0, inProgressWO: 0, completedWO: 0, totalSteps: 0, completedSteps: 0, totalQuantity: 0, completedQuantity: 0 });
  const [recentWOs, setRecentWOs] = useState<any[]>([]);
  const [productStats, setProductStats] = useState<ProductStat[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: workOrders } = await supabase.from('work_orders').select('*');
      const { data: steps } = await supabase.from('process_steps').select('*');
      const { data: products } = await supabase.from('products').select('id, name');

      if (workOrders) {
        const open = workOrders.filter(w => w.status === 'open').length;
        const inProg = workOrders.filter(w => w.status === 'in_progress').length;
        const completed = workOrders.filter(w => w.status === 'completed').length;
        const totalQty = workOrders.reduce((s, w) => s + w.total_quantity, 0);

        const completedQty = steps?.reduce((s, st) => s + st.completed_quantity, 0) || 0;
        const completedSteps = steps?.filter(s => s.status === 'completed').length || 0;

        setStats({
          totalWO: workOrders.length,
          openWO: open,
          inProgressWO: inProg,
          completedWO: completed,
          totalSteps: steps?.length || 0,
          completedSteps,
          totalQuantity: totalQty,
          completedQuantity: completedQty,
        });

        setRecentWOs(workOrders.slice(-5).reverse());

        // Product stats
        if (products) {
          const productMap = new Map(products.map(p => [p.id, p.name]));
          const counts: Record<string, number> = {};
          workOrders.forEach(wo => {
            const pName = wo.product_id ? (productMap.get(wo.product_id) || 'Unknown') : 'Unassigned';
            counts[pName] = (counts[pName] || 0) + 1;
          });
          setProductStats(Object.entries(counts).map(([name, count]) => ({ name, count })));
        }
      }
    };
    fetchData();
  }, []);

  const woStatusData = [
    { name: 'Open', value: stats.openWO },
    { name: 'In Progress', value: stats.inProgressWO },
    { name: 'Completed', value: stats.completedWO },
  ].filter(d => d.value > 0);

  const productionData = [
    { name: 'Completed', value: stats.completedQuantity },
    { name: 'Remaining', value: Math.max(0, stats.totalQuantity - stats.completedQuantity) },
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, 'default' | 'warning' | 'success'> = {
      open: 'default',
      in_progress: 'warning',
      completed: 'success',
    };
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <Card key={card.label} className="stat-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold mt-1">{card.value}</p>
                </div>
                <card.icon className={cn('h-8 w-8', card.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Work Order Status</CardTitle>
          </CardHeader>
          <CardContent>
            {woStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={woStatusData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {woStatusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">No data yet</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Production Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={productionData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(174, 60%, 40%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Work Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {recentWOs.length > 0 ? (
            <div className="space-y-3">
              {recentWOs.map(wo => (
                <div key={wo.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <span className="font-medium">{wo.wo_number}</span>
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
