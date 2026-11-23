import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/binary packages must stay external to the server bundle.
  serverExternalPackages: ["ffmpeg-static", "@prisma/client", ".prisma/client"],
};

export default nextConfig;
