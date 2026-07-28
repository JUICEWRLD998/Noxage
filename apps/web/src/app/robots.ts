import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Belt-and-braces: /styleguide also sets metadata.robots = "noindex".
      disallow: "/styleguide",
    },
  };
}
