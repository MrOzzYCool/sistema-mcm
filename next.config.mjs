/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // react-pdf needs canvas to be excluded from bundling
    config.resolve.alias.canvas = false;
    return config;
  },
};
export default nextConfig;
