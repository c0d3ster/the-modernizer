import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@modernizer/ui'],
  // A visual harness for the blocks: placeholder images (often SVG) are shown as-is
  images: { unoptimized: true },
}

export default nextConfig
