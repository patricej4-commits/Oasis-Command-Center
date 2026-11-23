# Oasis Command Center

A private, two-person workspace for Patrice Jackson (Executive Assistant / Operations Coordinator) and AJ (Aaron Johnson, CEO) at Oasis Fresh Market.

- **AJ's view** (`/aj`): built for a phone. Decisions, Top 3, updates, plan, schedule, meetings, sales, end of day report, running list, and a "Give Patrice a Task" button.
- **Patrice's view** (`/patrice`): built for a desktop. Inbox from AJ, Running List, Decisions and Follow-up tracker, Report Builder, Team Check-ins and Archive.

Stack: Next.js 14 (App Router) + TypeScript + Tailwind, Supabase (Postgres, Auth, Storage, Realtime) and Vercel. The app is a PWA, so you can add it to the home screen on iPhone and Android.

---

## 1. Supabase setup (one time)

1. Create a free project at https://supabase.com.
2. Open **SQL Editor**, paste all of `supabase/schema.sql`, and click **Run**. This creates the tables, the security rules, the private `oasis-files` storage bucket, and realtime.
3. Open **Authentication > URL Configuration**:
   - **Site URL**: your Vercel URL, for example `https://oasis-command-center.vercel.app`
   - **Redirect URLs**: add `https://YOUR-VERCEL-URL/auth/callback` and `http://localhost:3000/auth/callback`
4. Open **Authentication > Email Templates > Magic Link** and add the 6-digit code so it works inside the home screen app on iPhone. Add this line to the template:
   ```
   <p>Or enter this code: <strong>{{ .Token }}</strong></p>
   ```
   On iPhone, a home screen app does not share sign-in with Safari, so AJ should type the code instead of tapping the link.
5. Open **Project Settings > API** and copy the Project URL, the `anon` public key and the `service_role` key.

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill it in:

| Variable | Where it is used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | App and Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | App and Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | Seed script only. Never add it to Vercel or share it. |
| `PATRICE_EMAIL` | Seed script: Patrice's sign-in email (admin) |
| `AJ_EMAIL` | Seed script: AJ's sign-in email (executive) |

## 3. Seed today's data and run locally

```bash
npm install
npm run seed
npm run dev
```

Open http://localhost:3000 and sign in with your email.

The seed adds the two allowed users, the team (Michelle, Kamena, Leea, Larry), today's decisions for AJ, the Top 3, today's plan and the Nov 16 to 22 sales. You can run it again safely. It skips items that already exist.

## 4. Deploy to Vercel from GitHub

1. Push this folder to GitHub (repo `Oasis-Command-Center`).
2. At https://vercel.com, click **Add New > Project** and import the GitHub repo.
3. Add the environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then click **Deploy**.
4. Put the Vercel URL into Supabase (step 1.3).

Every push to the `main` branch deploys automatically.

## 5. Adding AJ (or changing emails)

Only emails in the `allowed_users` table can sign in. Everyone else is blocked.

- Fastest: set `AJ_EMAIL` in `.env.local` and run `npm run seed`.
- Or in Supabase **Table Editor > allowed_users**, insert a row: `email` = AJ's email, `role` = `aj`, `display_name` = `Aaron Johnson`.

Then send AJ the link. He enters his email, gets a code by email, and types it in.

## 6. Install on any device

Live link: **https://oasis-command-center-mu.vercel.app**

- **iPhone or iPad**: open the link in **Safari**, tap **Share**, then **Add to Home Screen**. Open the app from the home screen and sign in with the email code.
- **Android**: open the link in **Chrome**, tap the menu, then **Install app** or **Add to Home screen**.
- **Windows PC**: open the link in **Chrome** or **Edge**. Click the install icon at the right end of the address bar (or menu > **Install Oasis Command Center**). It opens in its own window and can be pinned to the taskbar.
- **MacBook**: in **Chrome**, click the install icon in the address bar. In **Safari** (macOS Sonoma or later), choose **File > Add to Dock**.

Any modern browser also works without installing: just open the link.

## 7. Publishing the daily reports

1. Go to **Report Builder** in Patrice's view.
2. **Morning Report**: fill in Updates (person, text and status tag), Plan for Today (tick Top 3 on up to three items), AJ's schedule, anything you need from AJ, sales numbers and the sales report image, and meetings. The form starts with yesterday's updates and plan so you only edit what changed.
3. Click **Save draft** at any time, then **Publish Morning Report**. AJ's view updates right away.
4. At the end of the day, switch to **End of Day Report**, fill in updates and your plan for tomorrow, and click **Publish End of Day Report**. AJ can read it that evening.
5. Every published report is kept in **Archive** by date.

"Normal daily email and WhatsApp checking and handling" is always added to the plan.

## 8. Sales import

Run `supabase/sales.sql` once in the Supabase SQL Editor (already done for the live project).

**Square (Sugar Llamas), automatic**
1. Go to https://developer.squareup.com/apps and sign in with the Square account. Click **Create an app** (any name, for example "Oasis Command Center").
2. Open the app, switch the toggle at the top to **Production**, and copy the **Production Access token**.
3. In Vercel: Settings > Environment Variables > Add. Type **Secret**, Key `SQUARE_ACCESS_TOKEN`, paste the token, Save. Then redeploy.
4. If the Square account has more than one location, also add `SQUARE_LOCATION_ID` (Config) with the Sugar Llamas location ID.
5. In Report Builder, click **Sync Square now**. Yesterday, week to date, best seller and busiest hour fill in automatically.

**Amazon Just Walk Out (Western Supply), upload**
Amazon does not offer a sales API for JWO stores. Download the daily Orders report (CSV) from the JWO merchant portal, then in Report Builder click **Upload JWO report (CSV)**, check the detected columns, and click **Save these totals**. For fully automatic data later, ask the Amazon JWO team about Intra-day reporting (CSV delivered to AWS S3).

## 9. Amy connector (Claude updates the app directly)

The app includes a connector so a Claude chat (for example the "Amy" chat) can read the Command Center and update reports, decisions, Running List items and meetings. It acts as Patrice and follows the same rules (nothing goes to Done except through Final Review in the app).

Setup (one time):
1. Supabase: Project Settings > API Keys (Legacy) > copy the **service_role** key.
2. Vercel: add Environment Variable, Type **Secret**, Key `SUPABASE_SERVICE_ROLE_KEY`, paste, Save.
3. Make up a long secret phrase (at least 24 characters, letters and numbers only, no spaces). Vercel: add Secret `AMY_CONNECTOR_SECRET` with that phrase.
4. Redeploy in Vercel.
5. In Claude: Settings > Connectors > **Add custom connector**. Name: Oasis Command Center. URL: `https://oasis-command-center-mu.vercel.app/api/mcp/YOUR-SECRET-PHRASE`. Then enable it in the Amy chat.

Treat the connector URL like a password. Anyone with it can change the app's data. To revoke access, change `AMY_CONNECTOR_SECRET` in Vercel and redeploy.

Tools Amy gets: get_dashboard, save_report, add_decision, update_decision, save_task, accept_task_request, add_meeting.

## How things work

- **Decisions**: Patrice adds items in Decisions (or from Team Check-ins). They appear at the top of AJ's view. When AJ taps Approve, Decline or Discuss, the item leaves his queue and shows up in Patrice's Inbox under "AJ responded".
- **Follow-up tracker**: "Copy nudge" copies a follow-up message and counts it. After 3 nudges in one day (Central Time) with no answer, the item shows **Call AJ**.
- **Running List rule**: Done is not in the normal status list. Move finished work to Final Review, then use **Mark Done**. The database also enforces this.
- **Tasks from AJ**: AJ's tasks arrive in Patrice's Inbox in real time with voice notes, photos, links and files. **Accept into Running List** turns a task into a running list item.
- **Times**: everything is in Central Time (Tulsa). Patrice's header also shows Jamaica time.
- **Files**: stored in a private bucket and shown with links that expire after one hour.

## Phase 2 (not built yet)

- Two-way sync with the monday.com Running List board (board 18432611876, status column `color_mm7gvym3`). The `tasks.monday_item_id` column is ready for this.
- Email and WhatsApp notifications when AJ submits a task or acts on a decision.
- Automatic sales import from Square and Amazon JWO exports.
- Voice note transcription.
