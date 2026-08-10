import type { NextConfig } from "next";

/** The real Odoo 19 + OpenEduCat instance backing the SIS and LMS tiles. */
const ODOO = process.env.ODOO_URL ?? "http://localhost:8069";

const nextConfig: NextConfig = {
  experimental: {
    // Enables forbidden() / unauthorized(), which the data access layer throws
    // when a signed-in user reaches for a learner outside their scope.
    authInterrupts: true,
  },

  /**
   * Proxy Odoo under this app's own origin.
   *
   * Odoo sends `X-Frame-Options: SAMEORIGIN`, so embedding it from a different
   * port would be blocked by the browser. Serving it through these rewrites
   * makes it same-origin, which lets a tile iframe the real application.
   *
   * The paths are proxied at their original top level rather than under a
   * prefix, because Odoo emits absolute asset URLs (/web/assets/...) that would
   * otherwise 404 against this app.
   */
  async rewrites() {
    return [
      { source: "/odoo/:path*", destination: `${ODOO}/odoo/:path*` },
      { source: "/web/:path*", destination: `${ODOO}/web/:path*` },
      { source: "/website/:path*", destination: `${ODOO}/website/:path*` },
      { source: "/mail/:path*", destination: `${ODOO}/mail/:path*` },
      { source: "/bus/:path*", destination: `${ODOO}/bus/:path*` },
      { source: "/jsonrpc", destination: `${ODOO}/jsonrpc` },
    ];
  },
};

export default nextConfig;
