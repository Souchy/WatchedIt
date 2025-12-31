/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TITLE: string
  readonly VITE_BASE: string
  readonly VITE_REDIRECT_URI: string
  readonly VITE_NODE_ENV: string
  readonly VITE_TMDB_API_KEY: string
  readonly VITE_TMDB_ACCESS_TOKEN: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
