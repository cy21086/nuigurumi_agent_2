import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig & { turbopack?: { root?: string } } = {
  /* config options here */
  // 明示的に Turbopack のルートを指定して、親ディレクトリの lockfile 選択や
  // ルート推測による問題を回避します。
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
