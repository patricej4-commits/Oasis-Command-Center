'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/auth';
import { ctToday, ctLocalToIso } from '@/lib/time';
import type { ReportData } from '@/lib/types';
import { upsertSalesDays } from '@/lib/salesStore';

export type NewAttachment = { path: string; file_name: string; mime: string; kind: 'voice' | 'image' | 'file' };
type Result = { ok: true; id?: string } | { ok: false; error: string };

function done(id?: string): Result {
  revalidatePath('/', 'layout');
  return { ok: true, id };
}

async function ctx(requiredRole?: 'patrice' | 'aj') {
  const me = await getMe();
  if (!me) throw new Error('You are not signed in.');
  if (requiredRole && me.role !== requiredRole) throw new Error('You do not have access to do that.');
  return { me, supabase: createClient() };
}

async function addAttachments(ownerType: string, ownerId: string, atts: NewAttachment[] | undefined) {
  if (!atts || atts.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from('attachments')
    .insert(atts.map((a) => ({ ...a, owner_type: ownerType, owner_id: ownerId })));
  if (error) throw new Error(error.message);
}

function wrap<A extends unknown[]>(fn: (...args: A) => Promise<Result>) {
  return async (...args: A): Promise<Result> => {
    try {
      return await fn(...args);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Something went wrong.' };
    }
  };
}

// ---------------------------------------------------------------- Task requests

export async function createTaskRequest(input: {
  title: string;
  details?: string;
  links?: string[];
  priority?: string | null;
  due_date?: string | null;
  attachments?: NewAttachment[];
}) {
  return wrap(async () => {
    const { supabase, me } = await ctx();
    if (!input.title.trim()) throw new Error('Please add a title.');
    const { data, error } = await supabase
      .from('task_requests')
      .insert({
        title: input.title.trim(),
        details: input.details?.trim() || null,
        links: (input.links ?? []).filter(Boolean),
        priority: input.priority || null,
        due_date: input.due_date || null,
        created_by: me.role,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    await addAttachments('request', data.id, input.attachments);
    return done(data.id);
  })();
}

export async function acceptRequest(id: string) {
  return wrap(async () => {
    const { supabase } = await ctx('patrice');
    const { data: req, error } = await supabase.from('task_requests').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    const { data: task, error: e2 } = await supabase
      .from('tasks')
      .insert({
        title: req.title,
        what_i_need: req.details,
        person_company: 'AJ',
        priority: req.priority || 'Medium',
        next_follow_up: req.due_date,
        category: 'From AJ',
        status: 'In Progress',
        source_request_id: req.id,
      })
      .select('id')
      .single();
    if (e2) throw new Error(e2.message);
    if (req.links?.length) {
      await supabase.from('task_updates').insert({ task_id: task.id, body: 'Links from AJ: ' + req.links.join(' ') });
    }
    await supabase.from('task_requests').update({ status: 'accepted', task_id: task.id }).eq('id', id);
    return done(task.id);
  })();
}

export async function dismissRequest(id: string) {
  return wrap(async () => {
    const { supabase } = await ctx('patrice');
    const { error } = await supabase.from('task_requests').update({ status: 'dismissed' }).eq('id', id);
    if (error) throw new Error(error.message);
    return done();
  })();
}

// ---------------------------------------------------------------- Decisions

export async function createDecision(input: {
  title: string;
  context?: string;
  waiting_on?: string;
  attachments?: NewAttachment[];
}) {
  return wrap(async () => {
    const { supabase } = await ctx('patrice');
    if (!input.title.trim()) throw new Error('Please add a title.');
    const { data, error } = await supabase
      .from('decisions')
      .insert({ title: input.title.trim(), context: input.context?.trim() || null, waiting_on: input.waiting_on?.trim() || null })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    await addAttachments('decision', data.id, input.attachments);
    return done(data.id);
  })();
}

export async function updateDecision(id: string, fields: { title?: string; context?: string; waiting_on?: string; status?: string }) {
  return wrap(async () => {
    const { supabase } = await ctx('patrice');
    const patch: Record<string, unknown> = { ...fields };
    if (fields.status === 'waiting') patch.decided_at = null;
    const { error } = await supabase.from('decisions').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
    return done();
  })();
}

export async function deleteDecision(id: string) {
  return wrap(async () => {
    const { supabase } = await ctx('patrice');
    const { error } = await supabase.from('decisions').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return done();
  })();
}

/** AJ acts on a decision: approve, decline, discuss, or just comment. */
export async function actOnDecision(input: {
  id: string;
  action: 'approved' | 'declined' | 'discuss' | 'comment';
  body?: string;
  attachments?: NewAttachment[];
}) {
  return wrap(async () => {
    const { supabase, me } = await ctx();
    if (input.action === 'comment' && !input.body?.trim() && !input.attachments?.length) {
      throw new Error('Add a comment or a voice note first.');
    }
    const { data: reply, error } = await supabase
      .from('decision_replies')
      .insert({ decision_id: input.id, author_role: me.role, action: input.action, body: input.body?.trim() || null })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    await addAttachments('reply', reply.id, input.attachments);

    const patch: Record<string, unknown> = {};
    if (input.action !== 'comment') {
      patch.status = input.action;
      patch.decided_at = new Date().toISOString();
    }
    if (me.role === 'aj') patch.seen_by_patrice = false;
    if (Object.keys(patch).length) {
      const { error: e2 } = await supabase.from('decisions').update(patch).eq('id', input.id);
      if (e2) throw new Error(e2.message);
    }
    return done();
  })();
}

export async function markDecisionSeen(id: string | 'all') {
  return wrap(async () => {
    const { supabase } = await ctx('patrice');
    const q = supabase.from('decisions').update({ seen_by_patrice: true });
    const { error } = id === 'all' ? await q.eq('seen_by_patrice', false) : await q.eq('id', id);
    if (error) throw new Error(error.message);
    return done();
  })();
}

export async function addNudge(decisionId: string) {
  return wrap(async () => {
    const { supabase } = await ctx('patrice');
    const { error } = await supabase.from('nudges').insert({ decision_id: decisionId, nudge_date: ctToday() });
    if (error) throw new Error(error.message);
    return done();
  })();
}

// ---------------------------------------------------------------- Running list

export async function saveTask(input: {
  id?: string;
  title: string;
  person_company?: string;
  what_i_need?: string;
  current_state?: string;
  next_action?: string;
  waiting_on?: string;
  status: string;
  priority: string;
  category?: string;
  next_follow_up?: string;
}) {
  return wrap(async () => {
    const { supabase } = await ctx('patrice');
    if (!input.title.trim()) throw new Error('Please add a title.');
    if (input.status === 'Done') throw new Error('Move the item to Final Review first. Done is set from Final Review only.');
    const row = {
      title: input.title.trim(),
      person_company: input.person_company?.trim() || null,
      what_i_need: input.what_i_need?.trim() || null,
      current_state: input.current_state?.trim() || null,
      next_action: input.next_action?.trim() || null,
      waiting_on: input.waiting_on?.trim() || null,
      status: input.status,
      priority: input.priority,
      category: input.category?.trim() || null,
      next_follow_up: input.next_follow_up || null,
    };
    if (input.id) {
      const { error } = await supabase.from('tasks').update(row).eq('id', input.id);
      if (error) throw new Error(error.message);
      return done(input.id);
    }
    const { data, error } = await supabase.from('tasks').insert(row).select('id').single();
    if (error) throw new Error(error.message);
    return done(data.id);
  })();
}

export async function markTaskDone(id: string) {
  return wrap(async () => {
    const { supabase } = await ctx('patrice');
    const { error } = await supabase.from('tasks').update({ status: 'Done' }).eq('id', id);
    if (error) throw new Error(error.message);
    await supabase.from('task_updates').insert({ task_id: id, body: 'Marked Done after Final Review.' });
    return done();
  })();
}

export async function deleteTask(id: string) {
  return wrap(async () => {
    const { supabase } = await ctx('patrice');
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return done();
  })();
}

export async function addTaskUpdate(taskId: string, body: string) {
  return wrap(async () => {
    const { supabase, me } = await ctx('patrice');
    if (!body.trim()) throw new Error('Write an update first.');
    const { error } = await supabase.from('task_updates').insert({ task_id: taskId, body: body.trim(), author_role: me.role });
    if (error) throw new Error(error.message);
    await supabase.from('tasks').update({ current_state: body.trim() }).eq('id', taskId);
    return done();
  })();
}

// ---------------------------------------------------------------- Reports

export async function saveReport(kind: 'morning' | 'eod', data: ReportData, publish: boolean) {
  return wrap(async () => {
    const { supabase } = await ctx('patrice');
    const report_date = ctToday();
    const { data: existing } = await supabase
      .from('reports')
      .select('id, status')
      .eq('kind', kind)
      .eq('report_date', report_date)
      .maybeSingle();
    const row: Record<string, unknown> = { kind, report_date, data, updated_at: new Date().toISOString() };
    if (publish) {
      row.status = 'published';
      row.published_at = new Date().toISOString();
    }
    const { data: saved, error } = existing
      ? await supabase.from('reports').update(row).eq('id', existing.id).select('id').single()
      : await supabase.from('reports').insert(row).select('id').single();
    if (error) throw new Error(error.message);
    return done(saved.id);
  })();
}

// ---------------------------------------------------------------- Sales import

export async function saveSalesDays(
  store: 'sugar' | 'jwo',
  days: { sale_date: string; total_cents: number; orders: number; items: Record<string, number>; hours: Record<string, number> }[],
  source: string,
) {
  return wrap(async () => {
    const { supabase } = await ctx('patrice');
    await upsertSalesDays(supabase, store, days, source);
    return done();
  })();
}

// ---------------------------------------------------------------- Meetings

export async function addMeeting(input: { title: string; starts_local: string; location?: string }) {
  return wrap(async () => {
    const { supabase } = await ctx('patrice');
    if (!input.title.trim() || !input.starts_local) throw new Error('Add a title and a time.');
    const { error } = await supabase
      .from('meetings')
      .insert({ title: input.title.trim(), starts_at: ctLocalToIso(input.starts_local), location: input.location?.trim() || null });
    if (error) throw new Error(error.message);
    return done();
  })();
}

export async function deleteMeeting(id: string) {
  return wrap(async () => {
    const { supabase } = await ctx('patrice');
    const { error } = await supabase.from('meetings').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return done();
  })();
}

export async function setMeetingNeed(id: string, needed: boolean) {
  return wrap(async () => {
    const { supabase } = await ctx();
    const { error } = await supabase.from('meetings').update({ patrice_needed: needed }).eq('id', id);
    if (error) throw new Error(error.message);
    return done();
  })();
}

// ---------------------------------------------------------------- Team check-ins

export async function saveCheckinNote(memberId: string, notes: string) {
  return wrap(async () => {
    const { supabase } = await ctx('patrice');
    const { error } = await supabase
      .from('checkin_notes')
      .upsert({ member_id: memberId, note_date: ctToday(), notes, updated_at: new Date().toISOString() }, { onConflict: 'member_id,note_date' });
    if (error) throw new Error(error.message);
    return done();
  })();
}

export async function saveMemberTime(memberId: string, checkin_time: string) {
  return wrap(async () => {
    const { supabase } = await ctx('patrice');
    const { error } = await supabase.from('team_members').update({ checkin_time }).eq('id', memberId);
    if (error) throw new Error(error.message);
    return done();
  })();
}

export async function addMember(name: string) {
  return wrap(async () => {
    const { supabase } = await ctx('patrice');
    if (!name.trim()) throw new Error('Add a name.');
    const { error } = await supabase.from('team_members').insert({ name: name.trim(), sort: 99 });
    if (error) throw new Error(error.message);
    return done();
  })();
}
