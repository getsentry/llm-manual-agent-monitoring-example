import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for testing
  tracesSampleRate: 1.0,
  
  // Capture 100% for testing
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  
  // Enable debug mode for development
  debug: process.env.NODE_ENV === 'development',
  
  integrations: [
    Sentry.replayIntegration(),
  ],
});
