import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Save } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface WorkOrder {
  id: string;
  wo_number: string;
  description: string;
  total_quantity: number;
  status: string;
}

interface ProcessStep {
  id: string;
  step_name: string;
  step_order: number;
  assigned_to: string | null;
  assigned_quantity: number;
  completed_quantity: number;
  status: string;
}

interface Profile {
  user_id: string;
  full_name: string;
  role: string;
}

interface ProgressLog {
  id: string;
  quantity_completed: number;
  notes: string | null;
  created_at: string;
  updated_by: string;
}

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const { toast } = useToast();

  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<Record<string, ProgressLog[]>>({});
  const [addStepOpen, setAddStepOpen] = useState(false);
  const [newStepName, setNewStepName] = useState('');
  const [newStepQuantity, setNewStepQuantity] = useState('');
  const [newStepAssignee, setNewStepAssignee] = useState('');
  const [updateDialogOpen, setUpdateDialogOpen] = useState<string | null>(null);
  const [updateQty, setUpdateQty] = useState('');
  const [updateNotes, setUpdateNotes] = useState('');

  const canManageSteps = hasRole('admin') || hasRole('supervisor');

  const fetchAll = async () => {
    if (!id) return;
    const { data: woData } = await supabase.from('work_orders').select('*').eq('id', id).single();
    if (woData) setWo(woData);

    const { data: stepsData } = await supabase.from('process_steps').select('*').eq('work_order_id', id).order('step_order');
    if (stepsData) {
      setSteps(stepsData);
      // Fetch logs for each step
      const logMap: Record<string, ProgressLog[]> = {};
      for (const step of stepsData) {
        const { data: logData } = await supabase.from('progress_logs').select('*').eq('process_step_id', step.id).order('created_at', { ascending: false });
        if (logData) logMap[step.id] = logData;
      }
      setLogs(logMap);
    }

    const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, role');
    if (profilesData) setProfiles(profilesData);
  };

  useEffect(() => { fetchAll(); }, [id]);

  const addStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const qty = parseInt(newStepQuantity) || wo?.total_quantity || 0;
    const { error } = await supabase.from('process_steps').insert({
      work_order_id: id,
      step_name: newStepName,
      step_order: steps.length + 1,
      assigned_to: newStepAssignee || null,
      assigned_quantity: qty,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Step Added' });
      setAddStepOpen(false);
      setNewStepName('');
      setNewStepQuantity('');
      setNewStepAssignee('');
      fetchAll();

      // Update WO status if it's still open
      if (wo?.status === 'open') {
        await supabase.from('work_orders').update({ status: 'in_progress' }).eq('id', id);
      }
    }
  };

  const submitProgress = async (stepId: string) => {
    const qty = parseInt(updateQty);
    if (!qty || !user) return;

    const { error } = await supabase.from('progress_logs').insert({
      process_step_id: stepId,
      updated_by: user.id,
      quantity_completed: qty,
      notes: updateNotes || null,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    // Update step completed quantity
    const step = steps.find(s => s.id === stepId);
    if (step) {
      const newCompleted = step.completed_quantity + qty;
      const newStatus = newCompleted >= step.assigned_quantity ? 'completed' : 'in_progress';
      await supabase.from('process_steps').update({ completed_quantity: newCompleted, status: newStatus }).eq('id', stepId);
    }

    toast({ title: 'Progress Updated' });
    setUpdateDialogOpen(null);
    setUpdateQty('');
    setUpdateNotes('');
    fetchAll();
  };

  const getProfileName = (userId: string | null) => {
    if (!userId) return 'Unassigned';
    return profiles.find(p => p.user_id === userId)?.full_name || 'Unknown';
  };

  const stepStatusBadge = (status: string) => {
    const map: Record<string, 'secondary' | 'warning' | 'success'> = { pending: 'secondary', in_progress: 'warning', completed: 'success' };
    return <Badge variant={map[status] || 'secondary'}>{status.replace('_', ' ')}</Badge>;
  };

  if (!wo) return <div className="p-6 text-muted-foreground">Loading...</div>;

  const employees = profiles.filter(p => p.role === 'employee' || p.role === 'supervisor');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/work-orders')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{wo.wo_number}</h1>
          <p className="text-muted-foreground">{wo.description}</p>
        </div>
        <Badge variant={wo.status === 'completed' ? 'success' : wo.status === 'in_progress' ? 'warning' : 'default'} className="ml-auto text-sm">
          {wo.status.replace('_', ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="stat-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Quantity</p>
            <p className="text-xl font-bold">{wo.total_quantity} units</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Process Steps</p>
            <p className="text-xl font-bold">{steps.length}</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Completed Steps</p>
            <p className="text-xl font-bold">{steps.filter(s => s.status === 'completed').length} / {steps.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Process Steps</h2>
        {canManageSteps && (
          <Dialog open={addStepOpen} onOpenChange={setAddStepOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Step</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Process Step</DialogTitle>
              </DialogHeader>
              <form onSubmit={addStep} className="space-y-4">
                <div className="space-y-2">
                  <Label>Step Name</Label>
                  <Input value={newStepName} onChange={e => setNewStepName(e.target.value)} placeholder="e.g., Cutting, Threading" required />
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" value={newStepQuantity} onChange={e => setNewStepQuantity(e.target.value)} placeholder={String(wo.total_quantity)} />
                </div>
                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <Select value={newStepAssignee} onValueChange={setNewStepAssignee}>
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.user_id} value={emp.user_id}>{emp.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">Add Step</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-3">
        {steps.map(step => {
          const progress = step.assigned_quantity > 0 ? Math.round((step.completed_quantity / step.assigned_quantity) * 100) : 0;
          const stepLogs = logs[step.id] || [];
          return (
            <Card key={step.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full h-6 w-6 flex items-center justify-center">{step.step_order}</span>
                    <span className="font-medium">{step.step_name}</span>
                    {stepStatusBadge(step.status)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{getProfileName(step.assigned_to)}</span>
                    {(canManageSteps || step.assigned_to === user?.id) && step.status !== 'completed' && (
                      <Dialog open={updateDialogOpen === step.id} onOpenChange={(open) => setUpdateDialogOpen(open ? step.id : null)}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline"><Save className="h-3 w-3 mr-1" />Update</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Update Progress — {step.step_name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="text-sm text-muted-foreground">
                              Remaining: {step.assigned_quantity - step.completed_quantity} units
                            </div>
                            <div className="space-y-2">
                              <Label>Completed Quantity</Label>
                              <Input type="number" value={updateQty} onChange={e => setUpdateQty(e.target.value)} min="1" max={step.assigned_quantity - step.completed_quantity} required />
                            </div>
                            <div className="space-y-2">
                              <Label>Notes (optional)</Label>
                              <Textarea value={updateNotes} onChange={e => setUpdateNotes(e.target.value)} placeholder="Any remarks..." />
                            </div>
                            <Button onClick={() => submitProgress(step.id)} className="w-full">Submit Progress</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{step.completed_quantity} / {step.assigned_quantity} units</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="mt-2 h-1.5" />

                {stepLogs.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground">History</p>
                    {stepLogs.slice(0, 3).map(log => (
                      <div key={log.id} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{getProfileName(log.updated_by)} — {log.quantity_completed} units{log.notes ? ` (${log.notes})` : ''}</span>
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {steps.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No process steps yet. {canManageSteps ? 'Add steps to break down this work order.' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
