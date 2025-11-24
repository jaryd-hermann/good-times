// Deno type declarations for Supabase Edge Functions
// These are runtime globals available in Deno, but TypeScript needs type definitions

declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined
  }
}

// Global Deno object
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

