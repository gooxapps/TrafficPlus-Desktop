import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Mock Supabase client to prevent app crash when env vars are missing
const createMockSupabaseClient = () => {
  const mockQueryBuilder = () => {
    const builder = {
      select: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      upsert: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      single: () => Promise.resolve({ data: null, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
    };
    // Make it thenable
    (builder as any).then = (cb: any) => cb({ data: null, error: null });
    return builder;
  };

  return {
    from: () => mockQueryBuilder(),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: (callback: any) => {
        // Immediately call callback with null session
        callback("SIGNED_OUT", null);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: () => Promise.resolve(),
    },
  };
};

const supabaseEnabled = Boolean(url && key);

let supabaseInstance: any;

if (!supabaseEnabled) {
  console.warn("Missing Supabase environment variables, using mock client");
  // Create mock client for development without Supabase
  supabaseInstance = createMockSupabaseClient();
} else {
  supabaseInstance = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase = supabaseInstance;
export const isSupabaseEnabled = supabaseEnabled;
