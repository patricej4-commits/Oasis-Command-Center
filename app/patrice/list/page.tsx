import { createClient } from '@/lib/supabase/server';
import { loadAttachments } from '@/lib/files';
import { sortTasks } from '@/lib/sort';
import RunningList from './RunningList';
import type { Task, TaskRequest, TaskUpdate } from '@/lib/types';

export default async function ListPage({ searchParams }: { searchParams: { open?: string } }) {
  const supabase = createClient();
  const [{ data: tasks }, { data: updates }] = await Promise.all([
    supabase.from('tasks').select('*'),
    supabase.from('task_updates').select('*').order('created_at', { ascending: false }),
  ]);
  const list = sortTasks((tasks ?? []) as Task[]);
  const reqIds = list.map((t) => t.source_request_id).filter(Boolean) as string[];
  const { data: reqs } = reqIds.length ? await supabase.from('task_requests').select('*').in('id', reqIds) : { data: [] };
  const reqAtts = await loadAttachments('request', reqIds);

  return (
    <RunningList
      tasks={list}
      updates={(updates ?? []) as TaskUpdate[]}
      requests={(reqs ?? []) as TaskRequest[]}
      reqAtts={reqAtts}
      openId={searchParams.open}
    />
  );
}
