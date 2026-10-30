interface ImportMetaEnv {
  readonly APP_URL: string;
  readonly APP_API_URL: string;
  readonly APP_ENV: 'development' | 'staging' | 'production';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
