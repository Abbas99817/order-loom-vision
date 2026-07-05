import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';

interface WorkOrder {
  id: string;
  wo_number: string;
  description: string;
  total_quantity: number;
  status: string;
  created_at: string;
  product_id: string | null;
  client_id?: string | null;
  service_type_id?: string | null;
}

interface Option { id: string; name: string; }
interface StepSummary { work_order_id: string; completed_quantity: number; }

const ADD_NEW = '__add_new__';

export default function WorkOrders() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [stepSummaries, setStepSummaries] = useState<StepSummary[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [clients, setClients] = useState<Option[]>([]);
  const [serviceTypes, setServiceTypes] = useState<Option[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [woNumber, setWoNumber] = useState('');
  const [description, setDescription] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState('');
  const [addOpen, setAddOpen] = useState<null | 'client' | 'service'>(null);
  const [newOptionName, setNewOptionName] = useState('');
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchData = async () => {
    const { data: wos } = await supabase.from('work_orders').select('*').order('created_at', { ascending: false });
    if (wos) setWorkOrders(wos as WorkOrder[]);

    const { data: steps } = await supabase.from('process_steps').select('work_order_id, completed_quantity');
    if (steps) {
      const grouped: Record<string, number[]> = {};
      steps.forEach(s => {
        if (!grouped[s.work_order_id]) grouped[s.work_order_id] = [];
        grouped[s.work_order_id].push(s.completed_quantity);
      });
      setStepSummaries(Object.entries(grouped).map(([work_order_id, completions]) => ({
        work_order_id, completed_quantity: Math.min(...completions),
      })));
    }
  };

  const fetchLookups = async () => {
    const [p, c, s] = await Promise.all([
      supabase.from('products').select('id, name').order('name'),
      supabase.from('clients').select('id, name').order('name'),
      supabase.from('service_types').select('id, name').order('name'),
    ]);
    if (p.data) setProducts(p.data);
    if (c.data) setClients(c.data);
    if (s.data) setServiceTypes(s.data);
  };

  useEffect(() => { fetchData(); fetchLookups(); }, []);

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
      client_id: selectedClientId || null,
      service_type_id: selectedServiceTypeId || null,
    } as any);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Work Order Created', description: `${woNumber} has been created.` });
      setDialogOpen(false);
      setWoNumber(''); setDescription(''); setTotalQuantity('');
      setSelectedProductId(''); setSelectedClientId(''); setSelectedServiceTypeId('');
      fetchData();
    }
  };

  const handleAddNew = async () => {
    const name = newOptionName.trim();
    if (!name || !addOpen) return;
    const table = addOpen === 'client' ? 'clients' : 'service_types';
    const { data, error } = await supabase.from(table).insert({ name, created_by: user?.id } as any).select().single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    if (addOpen === 'client') {
      setClients(prev => [...prev, data as Option].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedClientId(data.id);
    } else {
      setServiceTypes(prev => [...prev, data as Option].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedServiceTypeId(data.id);
    }
    setNewOptionName('');
    setAddOpen(null);
  };

  const deleteWorkOrder = async (woId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('progress_logs').delete().in(
      'process_step_id',
      (await supabase.from('process_steps').select('id').eq('work_order_id', woId)).data?.map(s => s.id) || []
    );
    await supabase.from('process_steps').delete().eq('work_order_id', woId);
    const { error } = await supabase.from('work_orders').delete().eq('id', woId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Work order has been deleted.' });
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
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 pb-24 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Work Orders</h1>
          <p className="text-sm text-muted-foreground">Manage production work orders</p>
        </div>
        {(hasRole('admin') || hasRole('supervisor')) && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />New Work Order</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-lg">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Client / Company</Label>
                    <Select
                      value={selectedClientId}
                      onValueChange={(v) => v === ADD_NEW ? setAddOpen('client') : setSelectedClientId(v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                      <SelectContent>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        <SelectItem value={ADD_NEW} className="text-primary font-medium">+ Add new client</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Service Type / Domain</Label>
                    <Select
                      value={selectedServiceTypeId}
                      onValueChange={(v) => v === ADD_NEW ? setAddOpen('service') : setSelectedServiceTypeId(v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                      <SelectContent>
                        {serviceTypes.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        <SelectItem value={ADD_NEW} className="text-primary font-medium">+ Add new service type</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
                    <SelectContent>
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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

      {/* Add-new dialog for client / service type */}
      <Dialog open={addOpen !== null} onOpenChange={(o) => { if (!o) { setAddOpen(null); setNewOptionName(''); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add new {addOpen === 'client' ? 'client / company' : 'service type / domain'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={newOptionName}
              onChange={e => setNewOptionName(e.target.value)}
              placeholder={addOpen === 'client' ? 'Acme Corp' : 'Web Development'}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddNew(); } }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(null); setNewOptionName(''); }}>Cancel</Button>
            <Button onClick={handleAddNew} disabled={!newOptionName.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search work orders..." className="pl-9" />
      </div>

      <div className="grid gap-3 sm:gap-4">
        {filtered.map(wo => {
          const progress = getProgress(wo.id);
          const client = wo.client_id ? clients.find(c => c.id === wo.client_id) : null;
          const service = wo.service_type_id ? serviceTypes.find(s => s.id === wo.service_type_id) : null;
          return (
            <Card key={wo.id} className="cursor-pointer hover:shadow-md active:scale-[0.99] transition-all" onClick={() => navigate(`/work-orders/${wo.id}`)}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                    <span className="font-bold text-base sm:text-lg break-all">{wo.wo_number}</span>
                    {statusBadge(wo.status)}
                    {wo.product_id && products.find(p => p.id === wo.product_id) && (
                      <Badge variant="outline" className="text-xs">{products.find(p => p.id === wo.product_id)!.name}</Badge>
                    )}
                    {client && <Badge variant="secondary" className="text-xs">{client.name}</Badge>}
                    {service && <Badge variant="secondary" className="text-xs">{service.name}</Badge>}
                  </div>
                  {(hasRole('admin') || hasRole('supervisor')) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={e => e.stopPropagation()}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={e => e.stopPropagation()} className="max-w-[95vw]">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Work Order?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently delete {wo.wo_number} and all its steps and progress logs. This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={(e) => deleteWorkOrder(wo.id, e)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                {wo.description && <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{wo.description}</p>}
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">{wo.total_quantity} units · {new Date(wo.created_at).toLocaleDateString()}</span>
                  <span className="font-medium">{progress}%</span>
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
