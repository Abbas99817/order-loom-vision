import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface WorkOrder {
  id: string;
  wo_number: string;
  description: string;
  total_quantity: number;
  status: string;
  created_at: string;
  product_id: string | null;
}

interface Product {
  id: string;
  name: string;
}

interface StepSummary {
  work_order_id: string;
  completed_quantity: number;
}

interface StepSummary {
  work_order_id: string;
  completed_quantity: number;
}

export default function WorkOrders() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [stepSummaries, setStepSummaries] = useState<StepSummary[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [woNumber, setWoNumber] = useState('');
  const [description, setDescription] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchData = async () => {
    const { data: wos } = await supabase.from('work_orders').select('*').order('created_at', { ascending: false });
    if (wos) setWorkOrders(wos);

    const { data: steps } = await supabase.from('process_steps').select('work_order_id, completed_quantity');
    if (steps) {
      // Group steps by WO - for sequential model, track min completion across steps
      const grouped: Record<string, number[]> = {};
      steps.forEach(s => {
        if (!grouped[s.work_order_id]) grouped[s.work_order_id] = [];
        grouped[s.work_order_id].push(s.completed_quantity);
      });
      const summaries = Object.entries(grouped).map(([work_order_id, completions]) => ({
        work_order_id,
        completed_quantity: Math.min(...completions), // bottleneck (min across steps)
      }));
      setStepSummaries(summaries);
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('id, name').order('name');
    if (data) setProducts(data);
  };

  useEffect(() => { fetchData(); fetchProducts(); }, []);

  const createWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(totalQuantity);
    if (!woNumber || !qty) return;

    const { error } = await supabase.from('work_orders').insert({
      wo_number: woNumber,
      description,
      total_quantity: qty,
      created_by: user?.id,
      product_id: selectedProductId || null,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Work Order Created', description: `${woNumber} has been created.` });
      setDialogOpen(false);
      setWoNumber('');
      setDescription('');
      setTotalQuantity('');
      setSelectedProductId('');
      fetchData();
    }
  };

  const getProgress = (woId: string) => {
    const woItem = workOrders.find(w => w.id === woId);
    const summary = stepSummaries.find(s => s.work_order_id === woId);
    if (!woItem || woItem.total_quantity === 0 || !summary) return 0;
    return Math.min(100, Math.round((summary.completed_quantity / woItem.total_quantity) * 100));
  };

  const statusBadge = (status: string) => {
    const map: Record<string, 'default' | 'warning' | 'success'> = { open: 'default', in_progress: 'warning', completed: 'success' };
    return <Badge variant={map[status] || 'default'}>{status.replace('_', ' ')}</Badge>;
  };

  const filtered = workOrders.filter(wo =>
    wo.wo_number.toLowerCase().includes(search.toLowerCase()) ||
    wo.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Work Orders</h1>
          <p className="text-muted-foreground">Manage production work orders</p>
        </div>
        {hasRole('admin') && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Work Order</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Work Order</DialogTitle>
              </DialogHeader>
              <form onSubmit={createWorkOrder} className="space-y-4">
                <div className="space-y-2">
                  <Label>Work Order Number</Label>
                  <Input value={woNumber} onChange={e => setWoNumber(e.target.value)} placeholder="WO#001" required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the work order..." />
                </div>
                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Total Quantity</Label>
                  <Input type="number" value={totalQuantity} onChange={e => setTotalQuantity(e.target.value)} placeholder="100" min="1" required />
                </div>
                <Button type="submit" className="w-full">Create Work Order</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search work orders..." className="pl-9" />
      </div>

      <div className="grid gap-4">
        {filtered.map(wo => {
          const progress = getProgress(wo.id);
          return (
            <Card key={wo.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/work-orders/${wo.id}`)}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg">{wo.wo_number}</span>
                    {statusBadge(wo.status)}
                    {wo.product_id && products.find(p => p.id === wo.product_id) && (
                      <Badge variant="outline" className="text-xs">{products.find(p => p.id === wo.product_id)!.name}</Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">{new Date(wo.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-muted-foreground text-sm mb-3">{wo.description}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{wo.total_quantity} units</span>
                  <span className="font-medium">{progress}% complete</span>
                </div>
                <Progress value={progress} className="mt-2 h-2" />
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {workOrders.length === 0 ? 'No work orders yet. Create one to get started!' : 'No matching work orders found.'}
          </div>
        )}
      </div>
    </div>
  );
}
