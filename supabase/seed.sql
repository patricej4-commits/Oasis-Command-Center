-- Oasis Command Center: seed today's data
-- 1. Replace the two emails below with your real emails.
-- 2. Paste this whole file into Supabase SQL Editor and click Run.
-- Safe to run more than once. It skips items that already exist.

-- ---------------------------------------------------------------
-- Allowed users (EDIT THESE TWO EMAILS)
-- ---------------------------------------------------------------
insert into allowed_users (email, role, display_name) values
  (lower('PATRICE_EMAIL_HERE'), 'patrice', 'Patrice Jackson'),
  (lower('AJ_EMAIL_HERE'), 'aj', 'Aaron Johnson')
on conflict (email) do update set role = excluded.role, display_name = excluded.display_name;

-- ---------------------------------------------------------------
-- Team
-- ---------------------------------------------------------------
insert into team_members (name, sort) values
  ('Michelle', 0), ('Kamena', 1), ('Leea', 2), ('Larry', 3)
on conflict (name) do nothing;

-- ---------------------------------------------------------------
-- Decisions for AJ
-- ---------------------------------------------------------------
insert into decisions (title, context, waiting_on)
select v.title, v.context, v.waiting_on
from (values
  ('Square Offline Payments: keep on or turn off?',
   E'Pro: card sales continue if the internet goes down.\nCon: cards are not checked while offline, so a decline is not known until later and that sale is lost.',
   'Patrice'),
  ('YMM field trip shirts: order more for the kids?',
   'Please confirm if we should order more shirts for the YMM field trip.',
   'Patrice'),
  ('Scorpio Moon Juicery and BuzzBot Vending',
   'Michelle is waiting on your direction for both vendors.',
   'Michelle'),
  ('Donations for the rest of the year',
   'Please confirm the donations for the rest of the year, including Mint to Prosper on Dec 11.',
   'Patrice'),
  ('TMG''s 2 scopes',
   E'Oasis Holiday Hope: $13,000 total.\nOasis Downtown Digital Advertising: $6,000 per month, ads start Dec 1.\nPlease approve, decline, or let me know what to change.',
   'TMG'),
  ('John and the $2,083 tech fee',
   'Let me know once you have spoken with John about the $2,083 tech fee.',
   'John')
) as v(title, context, waiting_on)
where not exists (select 1 from decisions d where d.title = v.title);

-- ---------------------------------------------------------------
-- Running list
-- ---------------------------------------------------------------
insert into tasks (title, person_company, what_i_need, next_action, waiting_on, status, priority, category, next_follow_up)
select v.* from (values
  ('Follow up with Kamena on the BlackHawk application', 'Kamena', 'Status of the BlackHawk application',
   'Check in with Kamena today', 'Kamena', 'Follow-up Needed', 'High', 'Operations', ct_today()),
  ('Square Offline Payments decision', 'AJ', 'AJ to decide whether to keep Square Offline Payments on or turn it off',
   'Get the decision from AJ', 'AJ', 'Waiting for Approval', 'High', 'Sugar Llamas', ct_today()),
  ('YMM planning', 'YMM', 'Field trip plan and shirt count',
   'Confirm shirt order with AJ', null, 'In Progress', 'High', 'Community', ct_today())
) as v(title, person_company, what_i_need, next_action, waiting_on, status, priority, category, next_follow_up)
where not exists (select 1 from tasks t where t.title = v.title);

-- ---------------------------------------------------------------
-- Today's published morning report (Top 3, plan, sales)
-- ---------------------------------------------------------------
insert into reports (kind, report_date, status, published_at, data) values (
  'morning', ct_today(), 'published', now(),
  '{
    "updates": [],
    "plan": [
      {"text": "Follow up with Kamena on the BlackHawk application", "top3": true},
      {"text": "Square Offline Payments decision", "top3": true},
      {"text": "YMM planning", "top3": true},
      {"text": "Normal daily email and WhatsApp checking and handling", "top3": false}
    ],
    "schedule": [],
    "sales": {
      "period": "Week of Nov 16 to 22",
      "sugar": {"yesterday": "", "wtd": "$483.92 (85 sales)", "best": "", "busiest": ""},
      "jwo": {"yesterday": "", "wtd": "$1,288.70 (210 orders)", "best": "", "busiest": ""},
      "image_path": null
    }
  }'::jsonb
)
on conflict (kind, report_date) do nothing;
