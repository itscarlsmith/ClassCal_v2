# ClassCal - Online Teaching Platform

ClassCal is an all-in-one online teaching platform that centralizes scheduling, live lessons, student management, payments, homework, materials, messaging, and administrative workflows.

## Demo Accounts

Once you've set up Supabase and run the seed data, use these credentials to test:

| Role | Email | Password |
|------|-------|----------|
| Teacher | `teacher@classcal.demo` | `ClassCal2024!` |
| Student | `student@classcal.demo` | `ClassCal2024!` |

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **State**: Zustand + TanStack Query
- **Calendar**: FullCalendar
- **Forms**: React Hook Form + Zod

## Features

### For Teachers
- 📅 **Calendar** - Drag-and-drop lesson scheduling with day/week/month views
- 👥 **Student CRM** - Manage students, track progress, store notes
- 📚 **Homework** - Assign, track, and review homework submissions
- 💬 **Messaging** - Real-time chat with students and parents
- 📁 **Materials Library** - Organize teaching resources (PDFs, videos, flashcards)
- 💰 **Finance** - Track payments, manage packages, view earnings
- ⚡ **Automation** - Set up lesson, homework, and payment reminders
- ⚙️ **Settings** - Profile, scheduling rules, cancellation policies

### For Students
- View scheduled lessons
- Check homework assignments
- Submit homework
- Message teacher
- View credit balance

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account (free tier works)

### 1. Clone and Install

```bash
cd ClassCal_v2
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Copy the URL and anon key from Settings → API
3. Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
```

### 3. Run Database Migrations

1. Go to Supabase Dashboard → SQL Editor
2. Copy and run `supabase/migrations/00001_initial_schema.sql`
3. This creates all tables, enums, RLS policies, and triggers

### 4. Create Demo Accounts

1. Go to Supabase Dashboard → Authentication → Users
2. Create two users:
   - Email: `teacher@classcal.demo`, Password: `ClassCal2024!`
   - Email: `student@classcal.demo`, Password: `ClassCal2024!`
3. Copy the User IDs and update them in `supabase/seed.sql` if they differ from:
   - Teacher: `11111111-1111-1111-1111-111111111111`
   - Student: `22222222-2222-2222-2222-222222222222`

### 5. Seed Demo Data

Run `supabase/seed.sql` in the SQL Editor to populate demo data.

### 6. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, Register pages
│   ├── (app)/           # Authenticated app routes
│   │   ├── dashboard/   # Overview and stats
│   │   ├── calendar/    # Calendar and availability
│   │   ├── lessons/     # Lesson management
│   │   ├── students/    # Student CRM
│   │   ├── homework/    # Homework assignments
│   │   ├── messages/    # Messaging
│   │   ├── library/     # Materials library
│   │   ├── finance/     # Payments and packages
│   │   ├── automation/  # Reminder rules
│   │   ├── settings/    # User settings
│   │   └── help/        # Help and docs
│   └── page.tsx         # Root redirect
├── components/
│   ├── drawer/          # Right-side drawer system
│   ├── sidebar/         # Navigation sidebar
│   └── ui/              # shadcn/ui components
├── lib/
│   ├── supabase/        # Supabase client utilities
│   ├── utils.ts         # General utilities
│   └── date.ts          # Date formatting utilities
├── store/
│   └── app-store.ts     # Zustand global state
├── types/
│   └── database.ts      # TypeScript types for DB
└── middleware.ts        # Auth middleware
```

## Database Schema

### Core Tables
- `profiles` - User profiles (extends auth.users)
- `students` - Students managed by teachers
- `parents` - Parent/guardian contacts
- `lessons` - Scheduled lessons
- `lesson_notes` - Notes for lessons
- `lesson_templates` - Reusable lesson templates
- `availability_blocks` - Teacher availability
- `homework` - Homework assignments
- `homework_submissions` - Student submissions
- `materials` - Teaching materials
- `messages` - Chat messages
- `message_threads` - Conversation threads
- `packages` - Lesson credit packages
- `payments` - Payment records
- `credit_ledger` - Credit transaction history
- `automation_rules` - Reminder settings
- `notifications` - User notifications
- `teacher_settings` - Teacher preferences

### Key Features
- Row Level Security (RLS) on all tables
- Automatic timestamps via triggers
- Credit system with ledger tracking
- Real-time messaging support

## Navigation

The app uses a persistent left-sidebar with expandable sections:

- **Dashboard** - Overview
- **Calendar** - Calendar, Availability, Scheduling Rules, Sync
- **Lessons** - Upcoming, Past, Recordings, Notes, Templates
- **Students** - Overview, List, Progress, Notes, Homework, Files, Payments, Parents
- **Homework** - All, To Review, Submitted, Overdue, Templates
- **Messages** - Inbox, Students, Parents, Groups
- **Library** - All Materials, Flashcards, Quizzes, Worksheets, Uploads
- **Finance** - Overview, Invoices, Payments, Payouts, Packages, Transactions, Reports
- **Automation** - Lesson/Homework/Payment Reminders
- **Settings** - Profile, Notifications, Calendar Sync, Video, Payments, Integrations, Billing
- **Help** - Support, Documentation, Shortcuts, What's New

## UX Patterns

### Right-Side Drawers
All detail views (student profile, lesson details, homework, etc.) open in a slide-in drawer panel from the right. This maintains context and allows quick navigation.

### Credit System
1. Teacher creates packages (e.g., "10 lessons for $400")
2. Student purchases package → credits added to balance
3. Lesson scheduled → credits reserved
4. Lesson completed → credits deducted
5. Late cancellation → credits consumed

### Lesson Status Flow
- `pending` - Awaiting student confirmation
- `confirmed` - Student accepted
- `completed` - Lesson finished (auto-set after end time)
- `cancelled` - Lesson cancelled

## Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint
npm run lint
```

## Deployment

Deploy to Vercel:

1. Push to GitHub
2. Import project on Vercel
3. Add environment variables
4. Deploy

## License

MIT
