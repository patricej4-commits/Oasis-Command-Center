export const TASK_STATUSES = [
  'In Progress',
  'Follow-up Needed',
  'Waiting for Reply',
  'Information Needed',
  'Waiting for Approval',
  'Scheduled',
  'On-Hold',
  'On Hold - Waiting on AJ to confirm',
  'Final Review',
  'Done',
  'Cancelled',
] as const;

// Statuses Patrice can pick in a normal edit. Done is reached only from Final Review.
export const EDITABLE_STATUSES = TASK_STATUSES.filter((s) => s !== 'Done');

export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;

export const UPDATE_PEOPLE = ['Michelle', 'Kamena', 'Leea', 'Larry', 'John', 'Vendors', 'Other'] as const;

export const UPDATE_STATUSES = [
  { value: 'done', label: 'Done', cls: 'bg-emerald-100 text-emerald-800' },
  { value: 'today', label: 'Today', cls: 'bg-sky-100 text-sky-800' },
  { value: 'waiting', label: 'Waiting', cls: 'bg-amber-100 text-amber-800' },
  { value: 'needs_ok', label: 'Needs your OK', cls: 'bg-red-100 text-red-800' },
  { value: 'closed', label: 'Closed', cls: 'bg-slate-200 text-slate-700' },
] as const;

export const DAILY_EMAIL_LINE = 'Normal daily email and WhatsApp checking and handling';

export const STATUS_CLASS: Record<string, string> = {
  'In Progress': 'bg-sky-100 text-sky-800',
  'Follow-up Needed': 'bg-orange-100 text-orange-800',
  'Waiting for Reply': 'bg-amber-100 text-amber-800',
  'Information Needed': 'bg-yellow-100 text-yellow-800',
  'Waiting for Approval': 'bg-red-100 text-red-800',
  Scheduled: 'bg-indigo-100 text-indigo-800',
  'On-Hold': 'bg-slate-200 text-slate-700',
  'On Hold - Waiting on AJ to confirm': 'bg-rose-100 text-rose-800',
  'Final Review': 'bg-purple-100 text-purple-800',
  Done: 'bg-emerald-100 text-emerald-800',
  Cancelled: 'bg-slate-100 text-slate-500',
};

export const PRIORITY_CLASS: Record<string, string> = {
  Critical: 'bg-red-600 text-white',
  High: 'bg-orange-500 text-white',
  Medium: 'bg-sky-600 text-white',
  Low: 'bg-slate-400 text-white',
};

export const DECISION_STATUS_CLASS: Record<string, string> = {
  waiting: 'bg-red-100 text-red-800',
  approved: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-slate-200 text-slate-800',
  discuss: 'bg-amber-100 text-amber-800',
};

export const BUCKET = 'oasis-files';
