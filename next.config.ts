import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

// Version the offline fallback page so outdated precached copies are replaced
// on every deploy. When the git commit isn't available (e.g. some CI setups),
// fall back to a random revision so the entry is still re-fetched.
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Cache pages as the user navigates so previously visited routes are
  // available offline on the next visit.
  cacheOnNavigation: true,
  // Reload once connectivity returns so the freshest shell is served.
  reloadOnOnline: true,
  // Never run the service worker in development; it would cache dev assets.
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [{ url: "/offline", revision }],
});

const nextConfig: NextConfig = {
  // Serwist injects a webpack config for the production build. Dev runs on
  // Turbopack with the service worker disabled, so declaring an empty Turbopack
  // config tells Next.js this mix is intentional and silences the warning.
  turbopack: {},
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
