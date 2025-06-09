/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_API_URL?: string;
  // 他の環境変数も必要に応じて追加
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
