import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/binary packages must stay external to the server bundle.
  serverExternalPackages: ["ffmpeg-static", "@prisma/client", ".prisma/client"],
  allowedDevOrigins: ["192.168.100.5"],
};

export default nextConfig;
