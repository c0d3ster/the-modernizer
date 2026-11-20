/** next/image's optimizer rejects SVGs and data URIs, so those are passed through unoptimized. */
export const skipOptimization = (src: string): boolean => /^data:|\.svg(?:$|[?#])/i.test(src)
