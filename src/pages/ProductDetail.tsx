import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { ArrowLeft, Package, ClipboardList, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

const PIE_COLORS = ['hsl(215, 70%, 50%)', 'hsl(38, 92%, 50%)', 'hsl(142, 60%, 40%)'];

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

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      const [prodRes, woRes] = await Promise.all([
        supabase.from('products').select('*').eq('id', id).single(),
        supabase.from('work_orders').select('*').eq('product_id', id),
      ]);
      setProduct(prodRes.data);
      setWorkOrders(woRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-6 text-center text-muted-foreground">Product not found.</div>
    );
  }

  const open = workOrders.filter(w => w.status === 'open').length;
  const inProgress = workOrders.filter(w => w.status === 'in_progress').length;
  const completed = workOrders.filter(w => w.status === 'completed').length;
  const totalQty = workOrders.reduce((s, w) => s + w.total_quantity, 0);

  const statusPieData = [
    { name: 'Open', value: open },
    { name: 'In Progress', value: inProgress },
    { name: 'Completed', value: completed },
  ].filter(d => d.value > 0);

  const quantityBarData = workOrders.map(wo => ({
    name: wo.wo_number,
    quantity: wo.total_quantity,
    status: wo.status,
  }));

  const statusBadge = (status: string) => {
    const map: Record<string, 'default' | 'warning' | 'success'> = {
      open: 'default', in_progress: 'warning', completed: 'success',
    };
    return <Badge variant={map[status] || 'default'}>{status.replace('_', ' ')}</Badge>;
  };

  const summaryCards = [
    { label: 'Total WOs', value: workOrders.length, icon: ClipboardList, color: 'text-primary' },
    { label: 'Open', value: open, icon: AlertCircle, color: 'text-info' },
    { label: 'In Progress', value: inProgress, icon: Clock, color: 'text-warning' },
    { label: 'Completed', value: completed, icon: CheckCircle2, color: 'text-success' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
            <p className="text-muted-foreground text-sm">{product.description || 'No description'}</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <Card key={card.label} className="border-none shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold mt-0.5 text-foreground">{card.value}</p>
                </div>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-sm text-muted-foreground">
        Total production quantity: <span className="font-semibold text-foreground">{totalQty} units</span>
      </div>

      {workOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No work orders for this product yet.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={statusPieData}
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
                      {statusPieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Quantity per Work Order</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={quantityBarData} barSize={32}>
                    <defs>
                      <linearGradient id="qtyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(215, 70%, 50%)" />
                        <stop offset="100%" stopColor="hsl(215, 70%, 35%)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="quantity" name="Quantity" fill="url(#qtyGrad)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* WO List */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Work Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {workOrders.map(wo => (
                  <div
                    key={wo.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 cursor-pointer transition-colors"
                    onClick={() => navigate(`/work-orders/${wo.id}`)}
                  >
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
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
