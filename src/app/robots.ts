import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/courses"], disallow: ["/dashboard", "/learn", "/studio", "/api"] },
  };
}
