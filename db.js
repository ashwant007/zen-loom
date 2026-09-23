// The app's memory (Supabase). Keys come from Vercel's settings, never the code.
import { createClient } from "@supabase/supabase-js";

// The public URL + anon key are safe on the frontend.
// The service key (server only) is used by backend routes to write safely.
export function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function serverClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
