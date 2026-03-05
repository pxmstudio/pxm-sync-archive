import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/app",
  transpilePackages: ["@workspace/ui"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
      },
      {
        protocol: "https",
        hostname: "cdn.contentspeed.ro",
      },
      {
        protocol: "https",
        hostname: "www.hubners.ro",
      },
      {
        protocol: "https",
        hostname: "*.avanticart.ro",
      },
      {
        protocol: "https",
        hostname: "aleo.ro",
      },
      {
        protocol: "https",
        hostname: "kidsconcept.ro",
      },
      {
        protocol: "https",
        hostname: "parteneri.smart-baby.ro",
      },
      {
        protocol: "https",
        hostname: "*.bebebrands.ro",
      },
      {
        protocol: "https",
        hostname: "*.babysafe.ro",
      },
      {
        protocol: "https",
        hostname: "*.partenerviva.ro",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "imagedelivery.net",
      },
    ],
  },
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
