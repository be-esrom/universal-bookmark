/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allows displaying og:image / product images pulled from arbitrary
    // external sites once URL extraction is wired up. Tightened later if needed.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
