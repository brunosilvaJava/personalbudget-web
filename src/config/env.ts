export const ENV = {
  PERSONALBUDGET_API_URL: import.meta.env.VITE_PERSONALBUDGET_API_URL || 'http://localhost:8080',
  IS_DEVELOPMENT: import.meta.env.DEV,
  IS_PRODUCTION: import.meta.env.PROD,
} as const;
