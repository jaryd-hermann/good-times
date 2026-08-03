/** @type {import('next').NextConfig} */
export default {
  // This app lives in a subfolder of a larger repo that has its own lockfile.
  // Pin the tracing root to this folder so Vercel bundles the right files.
  outputFileTracingRoot: import.meta.dirname,
}
