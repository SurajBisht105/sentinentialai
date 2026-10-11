import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/projects",
        destination: "/dashboard/projects",
        permanent: false,
      },
      {
        source: "/projects/:id*",
        destination: "/dashboard/projects/:id*",
        permanent: false,
      },
      {
        source: "/scans",
        destination: "/dashboard/scans",
        permanent: false,
      },
      {
        source: "/scans/:id*",
        destination: "/dashboard/scans/:id*",
        permanent: false,
      },
      {
        source: "/vulnerabilities",
        destination: "/dashboard/vulnerabilities",
        permanent: false,
      },
      {
        source: "/findings",
        destination: "/dashboard/vulnerabilities",
        permanent: false,
      },
      {
        source: "/settings",
        destination: "/dashboard/settings",
        permanent: false,
      },
      {
        source: "/integrations",
        destination: "/dashboard/integrations",
        permanent: false,
      },
      {
        source: "/agents",
        destination: "/dashboard/agents",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
