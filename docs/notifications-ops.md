# Notifications ops guide

## Database settings

### Option A (preferred in this repo): config table

Supabase may block setting custom `app.*` database parameters. This repo includes
`notification_dispatch_config` as a fallback for configuring the `pg_net` cron
job.

```
update notification_dispatch_config
set dispatch_url = 'https://<your-app-domain>/api/internal/notifications/dispatch',
    dispatch_secret = '<shared-secret>'
where id = 1;

select id, dispatch_url, (dispatch_secret is not null) as has_secret, updated_at
from notification_dispatch_config;
```

### Option B: database settings (if allowed)

```
alter database postgres set app.notifications_dispatch_url = 'https://<your-app-domain>/api/internal/notifications/dispatch';
alter database postgres set app.notifications_dispatch_secret = '<shared-secret>';

select current_setting('app.notifications_dispatch_url', true);
select current_setting('app.notifications_dispatch_secret', true);
```

## Inspecting the pipeline

### 1) New/failed notification events

```
select id, user_id, notification_type, event_key, status, last_error, created_at
from notification_events
where status in ('new', 'failed')
order by created_at desc
limit 100;
```

### 2) Outbox backlog

```
select id, user_id, to_email, subject, status, attempt_count, scheduled_for, last_error
from notification_email_outbox
where status in ('pending', 'failed', 'sending')
order by scheduled_for asc
limit 100;
```

### 3) Recently sent emails

```
select id, user_id, to_email, subject, sent_at
from notification_email_outbox
where status = 'sent'
order by sent_at desc
limit 100;
```

### 4) Recent in-app notifications for a user

```
select id, notification_type, priority, is_read, created_at
from notifications
where user_id = '<user-id>'
order by created_at desc
limit 50;
```

## Common recovery steps

### Reset stuck sending rows

```
update notification_email_outbox
set status = 'failed', locked_at = null, locked_by = null
where status = 'sending' and locked_at < now() - interval '15 minutes';
```

### Requeue failed emails

```
update notification_email_outbox
set status = 'pending', scheduled_for = now()
where status = 'failed' and attempt_count < 10;
```
