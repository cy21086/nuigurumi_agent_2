import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig & { turbopack?: { root?: string } } = {
  /* config options here */
  // 明示的に Turbopack のルートを指定して、親ディレクトリの lockfile 選択や
  // ルート推測による問題を回避します。
  turbopack: {
    root: path.resolve(__dirname),
  },
  // 静的エクスポートを明示する（next export による静的出力を有効にする）
  output: 'export',
  // Electron の file:// プロトコルで相対パスからアセットを読み込めるようにする
  // これにより HTML が `./_next/static/...` のような相対パスを出力します
  assetPrefix: './',
  // basePath を空にして明示的にルートを使わない設定にする
  basePath: '',
};

export default nextConfig;
