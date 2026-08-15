# Railway Scraper Service

This directory contains the background service that scrapes data and pushes it to the LMS API.

## Deployment to Railway

1. Create a new project in Railway.
2. Choose "Deploy from GitHub repo" and select this repository.
3. In the Railway dashboard, configure the Root Directory for this service to be `railway-scraper` (if running as a monorepo).
4. Add the required Environment Variables.

## Environment Variables Required

- `HACKERRANK_API_KEY`: API key for HackerRank (if applicable)
- `LMS_INGEST_URL`: The URL of your Next.js LMS API endpoint (e.g., `https://your-lms-url.com/api/ingest`)
- `SERVICE_ROLE_KEY`: Supabase Service Role key (for secure API authentication)

## Scheduling with Supabase pg_cron

If you want to trigger the scraper on a schedule without Railway's built-in cron, you can use Supabase `pg_cron`:

1. Enable the `pg_cron` extension in Supabase:
   ```sql
   create extension pg_cron;
   ```
2. Create a cron job to call your scraper endpoint (or a webhook that triggers it):
   ```sql
   select cron.schedule(
     'invoke-scraper',
     '0 * * * *', -- Every hour
     $$
     select net.http_post(
         url:='https://your-railway-app.up.railway.app/trigger',
         headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SECRET"}'::jsonb
     )
     $$
   );
   ```

## Configuring LMS_INGEST_URL

Set `LMS_INGEST_URL` to point directly to the API route in your Next.js application that handles incoming data from the scraper. Make sure you use HTTPS for production.

Example: `https://lms-production.vercel.app/api/ingest`
