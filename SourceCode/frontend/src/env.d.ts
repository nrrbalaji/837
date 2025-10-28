interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  // add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
