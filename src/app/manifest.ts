import type { MetadataRoute } from "next";

/** Installable-app manifest: "Add to Home Screen" gives Branch a real
 * app icon and a standalone window on the owner's phone. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Branch — Social Command Center",
    short_name: "Branch",
    description:
      "Track, analyze, and publish to every brand social account from one command deck.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#f4f5f7",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
