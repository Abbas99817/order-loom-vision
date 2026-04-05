import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';

interface TaskStep {
  id: string;
  step_name: string;
  step_order: number;
  assigned_quantity: number;
  completed_quantity: number;
  status: string;
  work_order_id: string;
  wo_number?: string;
  wo_description?: string;
}

export default function MyTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskStep[]>([]);
  const [updateDialogOpen, setUpdateDialogOpen] = useState<string | null>(null);
  const [updateQty, setUpdateQty] = useState('');
  const [updateNotes, setUpdateNotes] = useState('');

  const fetchTasks = async () => {
    if (!user) return;
    const { data: steps } = await supabase
      .from('process_steps')
      .select('*')
      .eq('assigned_to', user.id)
      .order('created_at', { ascending: false });

    if (steps) {
      const woIds = [...new Set(steps.map(s => s.work_order_id))];
      const { data: wos } = await supabase.from('work_orders').select('id, wo_number, description').in('id', woIds);

      const enriched = steps.map(s => {
        const wo = wos?.find(w => w.id === s.work_order_id);
        return { ...s, wo_number: wo?.wo_number, wo_description: wo?.description };
      });
      setTasks(enriched);
    }
  };

  useEffect(() => { fetchTasks(); }, [user]);

  const submitProgress = async (stepId: string) => {
    const qty = parseInt(updateQty);
    if (!qty || !user) return;
    const step = tasks.find(t => t.id === stepId);
    if (!step) return;

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
    const newStatus = newCompleted >= step.assigned_quantity ? 'completed' : 'in_progress';
    await supabase.from('process_steps').update({ completed_quantity: newCompleted, status: newStatus }).eq('id', stepId);

    toast({ title: 'Progress Updated' });
    setUpdateDialogOpen(null);
    setUpdateQty('');
    setUpdateNotes('');
    fetchTasks();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, 'secondary' | 'warning' | 'success'> = { pending: 'secondary', in_progress: 'warning', completed: 'success' };
    return <Badge variant={map[status] || 'secondary'}>{status.replace('_', ' ')}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Tasks</h1>
        <p className="text-muted-foreground">Your assigned process steps</p>
      </div>

      <div className="space-y-3">
        {tasks.map(task => {
          const progress = task.assigned_quantity > 0 ? Math.round((task.completed_quantity / task.assigned_quantity) * 100) : 0;
          return (
            <Card key={task.id}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-bold">{task.wo_number}</span>
                    <span className="text-muted-foreground ml-2 text-sm">→ {task.step_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(task.status)}
                    {task.status !== 'completed' && (
                      <Dialog open={updateDialogOpen === task.id} onOpenChange={(open) => setUpdateDialogOpen(open ? task.id : null)}>
                        <DialogTrigger asChild>
                          <Button size="sm"><Save className="h-3 w-3 mr-1" />Update</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Update — {task.step_name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                              Remaining: {task.assigned_quantity - task.completed_quantity} units
                            </p>
                            <div className="space-y-2">
                              <Label>Completed Quantity</Label>
                              <Input type="number" value={updateQty} onChange={e => setUpdateQty(e.target.value)} min="1" max={task.assigned_quantity - task.completed_quantity} required />
                            </div>
                            <div className="space-y-2">
                              <Label>Notes</Label>
                              <Textarea value={updateNotes} onChange={e => setUpdateNotes(e.target.value)} placeholder="Optional remarks..." />
                            </div>
                            <Button onClick={() => submitProgress(task.id)} className="w-full">Submit</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{task.wo_description}</p>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{task.completed_quantity} / {task.assigned_quantity} units</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="mt-2 h-2" />
              </CardContent>
            </Card>
          );
        })}
        {tasks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No tasks assigned to you yet.
          </div>
        )}
      </div>
    </div>
  );
}
