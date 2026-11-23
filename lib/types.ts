export type Role = 'patrice' | 'aj';

export type Attachment = {
  id: string;
  owner_type: string;
  owner_id: string;
  path: string;
  file_name: string | null;
  mime: string | null;
  kind: 'voice' | 'image' | 'file';
  created_at: string;
  url?: string | null;
};

export type Task = {
  id: string;
  title: string;
  person_company: string | null;
  what_i_need: string | null;
  current_state: string | null;
  next_action: string | null;
  waiting_on: string | null;
  status: string;
  priority: string;
  category: string | null;
  next_follow_up: string | null;
  last_update: string;
  source_request_id: string | null;
  created_at: string;
};

export type TaskUpdate = { id: string; task_id: string; author_role: string; body: string; created_at: string };

export type TaskRequest = {
  id: string;
  title: string;
  details: string | null;
  links: string[];
  priority: string | null;
  due_date: string | null;
  status: 'new' | 'accepted' | 'dismissed';
  task_id: string | null;
  created_at: string;
};

export type Decision = {
  id: string;
  title: string;
  context: string | null;
  waiting_on: string | null;
  status: 'waiting' | 'approved' | 'declined' | 'discuss';
  decided_at: string | null;
  seen_by_patrice: boolean;
  created_at: string;
};

export type DecisionReply = {
  id: string;
  decision_id: string;
  author_role: string;
  action: string | null;
  body: string | null;
  created_at: string;
};

export type UpdateItem = { person: string; text: string; status: string };
export type PlanItem = { text: string; top3: boolean };
export type ScheduleItem = { time: string; title: string; location: string };
export type SalesBlock = { yesterday: string; wtd: string; best: string; busiest: string };

export type ReportData = {
  updates?: UpdateItem[];
  plan?: PlanItem[];
  schedule?: ScheduleItem[];
  sales?: { period?: string; sugar?: SalesBlock; jwo?: SalesBlock; image_path?: string | null };
  tomorrow?: PlanItem[];
  note?: string;
};

export type Report = {
  id: string;
  kind: 'morning' | 'eod';
  report_date: string;
  status: 'draft' | 'published';
  data: ReportData;
  published_at: string | null;
};

export type Meeting = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
  patrice_needed: boolean | null;
};
