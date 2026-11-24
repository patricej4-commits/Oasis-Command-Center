import { NextResponse } from 'next/server';
import { createClient as createSupabase, type SupabaseClient } from '@supabase/supabase-js';
import { ctToday, ctLocalToIso } from '@/lib/time';
import { DAILY_EMAIL_LINE, EDITABLE_STATUSES, PRIORITIES, UPDATE_PEOPLE, UPDATE_STATUSES } from '@/lib/constants';
import { rollupFiles } from '@/lib/csv';
import { upsertSalesDays } from '@/lib/salesStore';

/**
 * Oasis Command Center connector for Claude (Model Context Protocol, Streamable HTTP, JSON responses).
 * Add in Claude as a custom connector: https://<app>/api/mcp/<AMY_CONNECTOR_SECRET>
 * Acts as Patrice. Needs SUPABASE_SERVICE_ROLE_KEY and AMY_CONNECTOR_SECRET in Vercel (both Secret).
 */

export const dynamic = 'force-dynamic';

type Json = Record<string, unknown>;
type Tool = {
  name: string;
  description: string;
  inputSchema: Json;
  run: (db: SupabaseClient, args: Json) => Promise<unknown>;
};

function db(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Connector is not set up: SUPABASE_SERVICE_ROLE_KEY is missing in Vercel.');
  return createSupabase(url, key, { auth: { persistSession: false } });
}

function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));
const opt = (v: unknown) => (str(v) ? str(v) : null);

const statusValues = UPDATE_STATUSES.map((s) => s.value);
const updateItem = {
  type: 'object',
  properties: {
    person: { type: 'string', enum: [...UPDATE_PEOPLE], description: 'Team member or group' },
    text: { type: 'string' },
    status: { type: 'string', enum: statusValues, description: 'done, today, waiting, needs_ok (needs AJ OK), closed' },
  },
  required: ['person', 'text', 'status'],
};
const planItem = {
  type: 'object',
  properties: { text: { type: 'string' }, top3: { type: 'boolean', description: 'Mark at most 3 items as Top 3' } },
  required: ['text'],
};
const salesBlock = {
  type: 'object',
  properties: { yesterday: { type: 'string' }, wtd: { type: 'string' }, best: { type: 'string' }, busiest: { type: 'string' } },
};

const TOOLS: Tool[] = [
  {
    name: 'get_dashboard',
    description:
      "Read the current state of the Oasis Command Center: decisions waiting on AJ (and AJ's recent answers), new task requests from AJ, open Running List items, upcoming meetings, and today's morning and end of day reports. Call this first.",
    inputSchema: { type: 'object', properties: {} },
    run: async (d) => {
      const today = ctToday();
      const [decisions, requests, tasks, meetings, reports] = await Promise.all([
        d.from('decisions').select('id,title,context,waiting_on,status,decided_at,created_at').order('created_at', { ascending: false }).limit(40),
        d.from('task_requests').select('id,title,details,links,priority,due_date,status,created_at').eq('status', 'new').order('created_at'),
        d.from('tasks').select('id,title,person_company,status,priority,next_action,waiting_on,next_follow_up,last_update').not('status', 'in', '("Done","Cancelled")').order('last_update', { ascending: false }),
        d.from('meetings').select('id,title,starts_at,location,patrice_needed').gte('starts_at', new Date(Date.now() - 3 * 3600e3).toISOString()).order('starts_at').limit(15),
        d.from('reports').select('kind,report_date,status,published_at,data').eq('report_date', today),
      ]);
      const ids = (must(decisions) as { id: string }[]).map((x) => x.id);
      const replies = ids.length
        ? must(await d.from('decision_replies').select('decision_id,author_role,action,body,created_at').in('decision_id', ids).order('created_at'))
        : [];
      return {
        today_central: today,
        decisions: must(decisions),
        decision_replies: replies,
        new_task_requests_from_aj: must(requests),
        open_running_list: must(tasks),
        upcoming_meetings: must(meetings),
        todays_reports: must(reports),
      };
    },
  },
  {
    name: 'save_report',
    description:
      'Create or update today\'s Morning or End of Day report. Only the sections you pass are replaced; others are kept. Set publish=true to make it visible to AJ now. "Normal daily email and WhatsApp checking and handling" is added to plans automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['morning', 'eod'] },
        updates: { type: 'array', items: updateItem },
        plan: { type: 'array', items: planItem, description: 'Morning: plan for today' },
        schedule: {
          type: 'array',
          items: { type: 'object', properties: { time: { type: 'string' }, title: { type: 'string' }, location: { type: 'string' } }, required: ['time', 'title'] },
          description: "AJ's schedule today, Central Time",
        },
        sales: {
          type: 'object',
          properties: { period: { type: 'string' }, sugar: salesBlock, jwo: salesBlock },
          description: 'sugar = Sugar Llamas (Square), jwo = Western Supply (Amazon Just Walk Out)',
        },
        tomorrow: { type: 'array', items: planItem, description: 'End of Day: plan for tomorrow' },
        note: { type: 'string', description: 'End of Day summary note' },
        publish: { type: 'boolean', description: 'true to publish to AJ, false to keep as draft' },
      },
      required: ['kind'],
    },
    run: async (d, a) => {
      const kind = a.kind === 'eod' ? 'eod' : 'morning';
      const today = ctToday();
      const existing = must(await d.from('reports').select('id,data,status').eq('kind', kind).eq('report_date', today).maybeSingle()) as
        | { id: string; data: Json; status: string }
        | null;
      const data: Json = { ...(existing?.data ?? {}) };
      const fixPlan = (p: unknown) => {
        const list = (Array.isArray(p) ? p : []).map((x: Json) => ({ text: str(x.text), top3: !!x.top3 })).filter((x) => x.text);
        let n = 0;
        list.forEach((x) => { if (x.top3 && ++n > 3) x.top3 = false; });
        if (!list.some((x) => /email and whatsapp/i.test(x.text))) list.push({ text: DAILY_EMAIL_LINE, top3: false });
        return list;
      };
      for (const k of ['updates', 'schedule', 'sales', 'note'] as const) if (a[k] !== undefined) data[k] = a[k];
      if (a.plan !== undefined) data.plan = fixPlan(a.plan);
      if (a.tomorrow !== undefined) data.tomorrow = fixPlan(a.tomorrow);
      const row: Json = { kind, report_date: today, data, updated_at: new Date().toISOString() };
      if (a.publish === true) { row.status = 'published'; row.published_at = new Date().toISOString(); }
      const saved = existing
        ? must(await d.from('reports').update(row).eq('id', existing.id).select('id,status').single())
        : must(await d.from('reports').insert(row).select('id,status').single());
      return { saved, kind, report_date: today };
    },
  },
  {
    name: 'add_decision',
    description: "Add an item to AJ's \"Needs Your Decision\" queue. Keep context to 2 or 3 plain lines.",
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string' }, context: { type: 'string' }, waiting_on: { type: 'string', description: 'Who is waiting on this' } },
      required: ['title'],
    },
    run: async (d, a) =>
      must(await d.from('decisions').insert({ title: str(a.title), context: opt(a.context), waiting_on: opt(a.waiting_on) }).select('id,title').single()),
  },
  {
    name: 'update_decision',
    description: 'Edit a decision, add a note from Patrice, or send it back to AJ (status waiting). Use get_dashboard for ids.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        context: { type: 'string' },
        waiting_on: { type: 'string' },
        send_back_to_aj: { type: 'boolean' },
        note: { type: 'string', description: 'A reply or note from Patrice on this decision' },
      },
      required: ['id'],
    },
    run: async (d, a) => {
      const patch: Json = {};
      if (a.title !== undefined) patch.title = str(a.title);
      if (a.context !== undefined) patch.context = opt(a.context);
      if (a.waiting_on !== undefined) patch.waiting_on = opt(a.waiting_on);
      if (a.send_back_to_aj) { patch.status = 'waiting'; patch.decided_at = null; }
      if (Object.keys(patch).length) must(await d.from('decisions').update(patch).eq('id', str(a.id)));
      if (str(a.note)) must(await d.from('decision_replies').insert({ decision_id: str(a.id), author_role: 'patrice', action: 'comment', body: str(a.note) }));
      return { ok: true };
    },
  },
  {
    name: 'save_task',
    description:
      'Create a Running List item (omit id) or update one (pass id). Status cannot be set to Done here: finished work goes to "Final Review", and Patrice marks Done in the app.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        person_company: { type: 'string' },
        what_i_need: { type: 'string' },
        current_state: { type: 'string' },
        next_action: { type: 'string' },
        waiting_on: { type: 'string' },
        status: { type: 'string', enum: [...EDITABLE_STATUSES] },
        priority: { type: 'string', enum: [...PRIORITIES] },
        category: { type: 'string' },
        next_follow_up: { type: 'string', description: 'YYYY-MM-DD' },
        update_note: { type: 'string', description: 'Adds a timestamped entry to the updates log' },
      },
    },
    run: async (d, a) => {
      if (a.status === 'Done') throw new Error('Move the item to Final Review. Patrice marks Done in the app.');
      const fields = ['title', 'person_company', 'what_i_need', 'current_state', 'next_action', 'waiting_on', 'status', 'priority', 'category', 'next_follow_up'];
      const row: Json = {};
      for (const f of fields) if (a[f] !== undefined) row[f] = opt(a[f]);
      let id = str(a.id);
      if (id) {
        if (Object.keys(row).length) must(await d.from('tasks').update(row).eq('id', id));
      } else {
        if (!row.title) throw new Error('A title is required for a new item.');
        row.status ??= 'In Progress';
        row.priority ??= 'Medium';
        id = (must(await d.from('tasks').insert(row).select('id').single()) as { id: string }).id;
      }
      if (str(a.update_note)) {
        must(await d.from('task_updates').insert({ task_id: id, body: str(a.update_note), author_role: 'patrice' }));
        must(await d.from('tasks').update({ current_state: str(a.update_note) }).eq('id', id));
      }
      return { id };
    },
  },
  {
    name: 'accept_task_request',
    description: "Accept a new task request from AJ into the Running List (use get_dashboard for ids).",
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    run: async (d, a) => {
      const req = must(await d.from('task_requests').select('*').eq('id', str(a.id)).single()) as Json;
      const task = must(
        await d.from('tasks').insert({
          title: req.title, what_i_need: req.details, person_company: 'AJ', priority: req.priority || 'Medium',
          next_follow_up: req.due_date, category: 'From AJ', status: 'In Progress', source_request_id: req.id,
        }).select('id').single(),
      ) as { id: string };
      must(await d.from('task_requests').update({ status: 'accepted', task_id: task.id }).eq('id', str(a.id)));
      return { task_id: task.id };
    },
  },
  {
    name: 'import_jwo_report',
    description:
      'Import Amazon Just Walk Out (Western Supply) daily reports. Pass the full text of the daily Sales CSV and, if available, the Refund CSV for the same day, exactly as downloaded from the JWO portal. Totals are before tax; refunds are subtracted. Returns the saved daily totals.',
    inputSchema: {
      type: 'object',
      properties: {
        sales_csv: { type: 'string', description: 'Full CSV text of the Sales report' },
        refund_csv: { type: 'string', description: 'Full CSV text of the Refund report (optional)' },
      },
      required: ['sales_csv'],
    },
    run: async (d, a) => {
      const texts = [str(a.sales_csv), str(a.refund_csv)].filter(Boolean);
      const { days, skipped, rows } = rollupFiles(texts);
      const saved = await upsertSalesDays(d, 'jwo', days, 'jwo-agent');
      return { lines_read: rows, lines_skipped: skipped, saved };
    },
  },
  {
    name: 'add_meeting',
    description: 'Add an upcoming meeting so AJ can mark whether Patrice is needed.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        starts_at_central: { type: 'string', description: 'Local Central Time, format YYYY-MM-DDTHH:MM' },
        location: { type: 'string' },
      },
      required: ['title', 'starts_at_central'],
    },
    run: async (d, a) =>
      must(await d.from('meetings').insert({ title: str(a.title), starts_at: ctLocalToIso(str(a.starts_at_central)), location: opt(a.location) }).select('id').single()),
  },
];

// ---------------------------------------------------------------- JSON-RPC handling

type RpcReq = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Json };

async function handle(msg: RpcReq): Promise<Json | null> {
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id: msg.id ?? null, result });
  const fail = (code: number, message: string) => ({ jsonrpc: '2.0', id: msg.id ?? null, error: { code, message } });
  if (msg.id === undefined || msg.id === null) return null; // notification

  switch (msg.method) {
    case 'initialize':
      return reply({
        protocolVersion: (msg.params?.protocolVersion as string) || '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'oasis-command-center', version: '1.0.0' },
        instructions:
          'Oasis Command Center for Patrice (EA) and AJ (CEO) at Oasis Fresh Market, Tulsa. Times are Central. Call get_dashboard first. Plain professional language, never use em dashes.',
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === msg.params?.name);
      if (!tool) return fail(-32602, 'Unknown tool');
      try {
        const out = await tool.run(db(), (msg.params?.arguments as Json) ?? {});
        return reply({ content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] });
      } catch (e) {
        return reply({ content: [{ type: 'text', text: e instanceof Error ? e.message : 'Failed' }], isError: true });
      }
    }
    default:
      return fail(-32601, 'Method not found');
  }
}

function authorized(secret: string) {
  const expected = process.env.AMY_CONNECTOR_SECRET || '';
  return expected.length >= 24 && secret === expected;
}

export async function POST(req: Request, { params }: { params: { secret: string } }) {
  if (!authorized(params.secret)) return new NextResponse('Not found', { status: 404 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handle(m as RpcReq)))).filter(Boolean);
    return out.length ? NextResponse.json(out) : new NextResponse(null, { status: 202 });
  }
  const out = await handle(body as RpcReq);
  return out ? NextResponse.json(out) : new NextResponse(null, { status: 202 });
}

export async function GET(_req: Request, { params }: { params: { secret: string } }) {
  if (!authorized(params.secret)) return new NextResponse('Not found', { status: 404 });
  return new NextResponse('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
}

export async function DELETE(_req: Request, { params }: { params: { secret: string } }) {
  if (!authorized(params.secret)) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(null, { status: 204 });
}
