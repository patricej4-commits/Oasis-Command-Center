// Seeds the two allowed users, the team, and today's real items.
// Run once after schema.sql:  npm run seed
// Needs .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PATRICE_EMAIL, AJ_EMAIL.
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const patrice = process.env.PATRICE_EMAIL;
const aj = process.env.AJ_EMAIL;
if (!url || !key || !patrice || !aj) {
  console.error('Missing values in .env.local. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PATRICE_EMAIL and AJ_EMAIL.');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

async function run(label, promise) {
  const { error } = await promise;
  if (error) {
    console.error(`${label}: ${error.message}`);
    process.exit(1);
  }
  console.log(`OK  ${label}`);
}

await run('allowed users', db.from('allowed_users').upsert([
  { email: patrice.toLowerCase(), role: 'patrice', display_name: 'Patrice Jackson' },
  { email: aj.toLowerCase(), role: 'aj', display_name: 'Aaron Johnson' },
]));

await run('team members', db.from('team_members').upsert(
  ['Michelle', 'Kamena', 'Leea', 'Larry'].map((name, i) => ({ name, sort: i })),
  { onConflict: 'name', ignoreDuplicates: true },
));

const decisions = [
  {
    title: 'Square Offline Payments: keep on or turn off?',
    context:
      'Pro: card sales continue if the internet goes down.\nCon: cards are not checked while offline, so a decline is not known until later and that sale is lost.',
    waiting_on: 'Patrice',
  },
  {
    title: 'YMM field trip shirts: order more for the kids?',
    context: 'Please confirm if we should order more shirts for the YMM field trip.',
    waiting_on: 'Patrice',
  },
  {
    title: 'Scorpio Moon Juicery and BuzzBot Vending',
    context: 'Michelle is waiting on your direction for both vendors.',
    waiting_on: 'Michelle',
  },
  {
    title: 'Donations for the rest of the year',
    context: 'Please confirm the donations for the rest of the year, including Mint to Prosper on Dec 11.',
    waiting_on: 'Patrice',
  },
  {
    title: "TMG's 2 scopes",
    context:
      'Oasis Holiday Hope: $13,000 total.\nOasis Downtown Digital Advertising: $6,000 per month, ads start Dec 1.\nPlease approve, decline, or let me know what to change.',
    waiting_on: 'TMG',
  },
  {
    title: 'John and the $2,083 tech fee',
    context: 'Let me know once you have spoken with John about the $2,083 tech fee.',
    waiting_on: 'John',
  },
];

const { data: existing } = await db.from('decisions').select('title');
const have = new Set((existing ?? []).map((d) => d.title));
const newDecisions = decisions.filter((d) => !have.has(d.title));
if (newDecisions.length) await run(`decisions (${newDecisions.length})`, db.from('decisions').insert(newDecisions));
else console.log('OK  decisions already seeded');

const tasks = [
  {
    title: 'Follow up with Kamena on the BlackHawk application',
    person_company: 'Kamena',
    what_i_need: 'Status of the BlackHawk application',
    next_action: 'Check in with Kamena today',
    waiting_on: 'Kamena',
    status: 'Follow-up Needed',
    priority: 'High',
    category: 'Operations',
    next_follow_up: today,
  },
  {
    title: 'Square Offline Payments decision',
    person_company: 'AJ',
    what_i_need: 'AJ to decide whether to keep Square Offline Payments on or turn it off',
    next_action: 'Get the decision from AJ',
    waiting_on: 'AJ',
    status: 'Waiting for Approval',
    priority: 'High',
    category: 'Sugar Llamas',
    next_follow_up: today,
  },
  {
    title: 'YMM planning',
    person_company: 'YMM',
    what_i_need: 'Field trip plan and shirt count',
    next_action: 'Confirm shirt order with AJ',
    status: 'In Progress',
    priority: 'High',
    category: 'Community',
    next_follow_up: today,
  },
];
const { data: existingTasks } = await db.from('tasks').select('title');
const haveT = new Set((existingTasks ?? []).map((t) => t.title));
const newTasks = tasks.filter((t) => !haveT.has(t.title));
if (newTasks.length) await run(`running list items (${newTasks.length})`, db.from('tasks').insert(newTasks));
else console.log('OK  running list already seeded');

await run('morning report', db.from('reports').upsert(
  {
    kind: 'morning',
    report_date: today,
    status: 'published',
    published_at: new Date().toISOString(),
    data: {
      updates: [],
      plan: [
        { text: 'Follow up with Kamena on the BlackHawk application', top3: true },
        { text: 'Square Offline Payments decision', top3: true },
        { text: 'YMM planning', top3: true },
        { text: 'Normal daily email and WhatsApp checking and handling', top3: false },
      ],
      schedule: [],
      sales: {
        period: 'Week of Nov 16 to 22',
        sugar: { yesterday: '', wtd: '$483.92 (85 sales)', best: '', busiest: '' },
        jwo: { yesterday: '', wtd: '$1,288.70 (210 orders)', best: '', busiest: '' },
        image_path: null,
      },
    },
  },
  { onConflict: 'kind,report_date' },
));

console.log('\nSeed complete.');
