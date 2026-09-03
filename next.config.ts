import type { NextConfig } from 'next';

// Static hosting. Images: no optimizer on a static host, so emit plain <img>.
// assetPrefix: when deploying under a GitHub Pages project subpath, this prefixes
// every /_next/ asset AND sets the webpack runtime publicPath, so lazily-loaded
// chunks resolve under the subpath too. Public-folder assets (/assets, /icon.svg,
// /ap-districts.geojson) and route links are not covered by assetPrefix and are
// handled by the post-build rewrite in scripts/build-static.mjs.
const assetPrefix = process.env.PAGES_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  ...(assetPrefix ? { assetPrefix } : {}),
};

export default nextConfig;
