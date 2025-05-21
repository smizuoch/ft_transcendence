import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html", // public/index.html から変更
    "./srcs/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Futura', 'sans-serif'], // Futuraをデフォルトのsans-serifフォントとして設定
      },
    },
  },
  plugins: [],
} satisfies Config
