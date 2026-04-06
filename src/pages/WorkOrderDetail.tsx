import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Save, Pencil } from 'lucide-react';
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
  const [editStepId, setEditStepId] = useState<string | null>(null);
  const [editStepQuantity, setEditStepQuantity] = useState('');
  const [editStepAssignee, setEditStepAssignee] = useState('');

  const canManageSteps = hasRole('admin') || hasRole('supervisor');

  const fetchAll = async () => {
    if (!id) return;
    const { data: woData } = await supabase.from('work_orders').select('*').eq('id', id).single();
    if (woData) setWo(woData);

    const { data: stepsData } = await supabase.from('process_steps').select('*').eq('work_order_id', id).order('step_order');
    if (stepsData) {
      setSteps(stepsData);
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

  // Sequential model: each step processes all WO units
  // Step progress = completed / WO total quantity (capped at 100%)
  // WO progress = average of all step progresses (bottleneck-aware)
  const getStepProgress = (step: ProcessStep) => {
    if (!wo || wo.total_quantity === 0) return 0;
    return Math.min(100, Math.round((step.completed_quantity / wo.total_quantity) * 100));
  };

  const woProgress = (() => {
    if (!wo || wo.total_quantity === 0 || steps.length === 0) return 0;
    // Use minimum step progress (bottleneck) for sequential workflow
    const stepProgresses = steps.map(s => Math.min(100, (s.completed_quantity / wo.total_quantity) * 100));
    return Math.round(Math.min(...stepProgresses));
  })();

  const totalCompletedAllSteps = steps.reduce((sum, s) => sum + Math.min(s.completed_quantity, wo?.total_quantity || 0), 0);
  const completedStepsCount = steps.filter(s => wo && s.completed_quantity >= wo.total_quantity).length;

  const updateWoStatus = async () => {
    if (!wo || !id) return;
    // WO complete only when ALL steps have completed all WO units
    const allDone = steps.length > 0 && steps.every(s => s.completed_quantity >= wo.total_quantity);
    if (allDone) {
      await supabase.from('work_orders').update({ status: 'completed' }).eq('id', id);
    } else if (steps.some(s => s.completed_quantity > 0) && wo.status !== 'in_progress') {
      await supabase.from('work_orders').update({ status: 'in_progress' }).eq('id', id);
    }
  };

  const addStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !wo) return;
    // Default quantity to WO total (sequential: each step processes all units)
    const qty = parseInt(newStepQuantity) || wo.total_quantity;
    if (qty <= 0) {
      toast({ title: 'Error', description: 'Quantity must be greater than 0.', variant: 'destructive' });
      return;
    }

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
      if (wo.status === 'open') {
        await supabase.from('work_orders').update({ status: 'in_progress' }).eq('id', id);
      }
      fetchAll();
    }
  };

  const submitProgress = async (stepId: string) => {
    const qty = parseInt(updateQty);
    if (!qty || !user || !wo) return;
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    // Validate: completed cannot exceed WO total quantity
    const maxRemaining = wo.total_quantity - step.completed_quantity;
    if (qty > maxRemaining) {
      toast({ title: 'Error', description: `Cannot exceed remaining ${maxRemaining} units for this WO.`, variant: 'destructive' });
      return;
    }

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

    const newCompleted = step.completed_quantity + qty;
    const newStatus = newCompleted >= wo.total_quantity ? 'completed' : 'in_progress';
    await supabase.from('process_steps').update({ completed_quantity: newCompleted, status: newStatus }).eq('id', stepId);

    toast({ title: 'Progress Updated' });
    setUpdateDialogOpen(null);
    setUpdateQty('');
    setUpdateNotes('');
    await fetchAll();

    // Check if ALL steps are now complete
    const updatedSteps = steps.map(s => s.id === stepId ? { ...s, completed_quantity: newCompleted } : s);
    const allDone = updatedSteps.every(s => s.completed_quantity >= wo.total_quantity);
    if (allDone) {
      await supabase.from('work_orders').update({ status: 'completed' }).eq('id', id);
      fetchAll();
    }
  };

  const saveStepEdit = async (stepId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (!step || !wo) return;
    const newQty = parseInt(editStepQuantity);
    if (isNaN(newQty) || newQty < step.completed_quantity) {
      toast({ title: 'Error', description: `Quantity cannot be less than already completed (${step.completed_quantity}).`, variant: 'destructive' });
      return;
    }

    const updates: Record<string, any> = { assigned_quantity: newQty };
    if (editStepAssignee) updates.assigned_to = editStepAssignee;
    if (newQty <= step.completed_quantity) updates.status = 'completed';

    const { error } = await supabase.from('process_steps').update(updates).eq('id', stepId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Step Updated' });
      setEditStepId(null);
      fetchAll();
    }
  };

  const openEditDialog = (step: ProcessStep) => {
    setEditStepId(step.id);
    setEditStepQuantity(String(step.assigned_quantity));
    setEditStepAssignee(step.assigned_to || '');
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

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
            <p className="text-sm text-muted-foreground">Steps Completed</p>
            <p className="text-xl font-bold">{completedStepsCount} / {steps.length}</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Overall Progress</p>
            <p className="text-xl font-bold">{woProgress}%</p>
            <Progress value={woProgress} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Process Steps</h2>
        {canManageSteps && (
          <Dialog open={addStepOpen} onOpenChange={setAddStepOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />Add Step
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Process Step</DialogTitle>
              </DialogHeader>
              <form onSubmit={addStep} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Each step processes units sequentially. Default: <strong>{wo.total_quantity}</strong> units.
                </p>
                <div className="space-y-2">
                  <Label>Step Name</Label>
                  <Input value={newStepName} onChange={e => setNewStepName(e.target.value)} placeholder="e.g., Cutting, Threading" required />
                </div>
                <div className="space-y-2">
                  <Label>Quantity (units to process in this step)</Label>
                  <Input type="number" value={newStepQuantity} onChange={e => setNewStepQuantity(e.target.value)} placeholder={String(wo.total_quantity)} min="1" />
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
          const stepProgress = getStepProgress(step);
          const remaining = Math.max(0, wo.total_quantity - step.completed_quantity);
          const stepLogs = logs[step.id] || [];
          const isStepDone = step.completed_quantity >= wo.total_quantity;
          return (
            <Card key={step.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full h-6 w-6 flex items-center justify-center">{step.step_order}</span>
                    <span className="font-medium">{step.step_name}</span>
                    {stepStatusBadge(isStepDone ? 'completed' : step.completed_quantity > 0 ? 'in_progress' : 'pending')}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{getProfileName(step.assigned_to)}</span>
                    {canManageSteps && (
                      <Button size="sm" variant="ghost" onClick={() => openEditDialog(step)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    {(canManageSteps || step.assigned_to === user?.id) && !isStepDone && (
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
                              Completed: {step.completed_quantity} / {wo.total_quantity} · Remaining: {remaining} units
                            </div>
                            <div className="space-y-2">
                              <Label>Completed Quantity</Label>
                              <Input type="number" value={updateQty} onChange={e => setUpdateQty(e.target.value)} min="1" max={remaining} required />
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
                  <span className="text-muted-foreground">{step.completed_quantity} / {wo.total_quantity} units</span>
                  <span className="font-medium">{stepProgress}%</span>
                </div>
                <Progress value={stepProgress} className="mt-2 h-1.5" />

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

      {/* Edit Step Dialog */}
      <Dialog open={!!editStepId} onOpenChange={(open) => !open && setEditStepId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Step — {steps.find(s => s.id === editStepId)?.step_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Assigned Quantity</Label>
              <Input type="number" value={editStepQuantity} onChange={e => setEditStepQuantity(e.target.value)} min={steps.find(s => s.id === editStepId)?.completed_quantity || 0} />
              <p className="text-xs text-muted-foreground">
                Min: {steps.find(s => s.id === editStepId)?.completed_quantity || 0} (already completed)
              </p>
            </div>
            <div className="space-y-2">
              <Label>Reassign To</Label>
              <Select value={editStepAssignee} onValueChange={setEditStepAssignee}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.user_id} value={emp.user_id}>{emp.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => editStepId && saveStepEdit(editStepId)} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
