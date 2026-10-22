interface ImportMetaEnv {
  readonly VITE_REACT_APP_URL: string;
  readonly VITE_REACT_APP_API_URL: string;
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
