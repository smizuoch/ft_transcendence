// 呼び出し元ファイルはvite.config.ts
export default {
  plugins: {
    tailwindcss: {}, // CSSにtailwindを適用するために必要
    autoprefixer: {}, // 自分たちが書いたCSSのクラスセレクタが他のベンダーのそれと名前衝突するのを防ぐために必要
  },
}
