import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './srcs'),
    },
  },
  server: {
    host: '0.0.0.0', // Dockerコンテナ内で外部からアクセス可能にするため
    port: 5173,      // Viteのデフォルト開発サーバーポート
    strictPort: true, // 指定ポートが使用中の場合エラーにする
    hmr: {           // Hot Module Replacement
      clientPort: 5173, // Nginx経由でない場合のクライアントポート (開発時)
    }
  },
  build: {
    outDir: 'dist', // ビルド成果物の出力ディレクトリ
  }, // build オブジェクトの閉じ括弧
})
