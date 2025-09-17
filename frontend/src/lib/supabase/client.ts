import { createClient } from "@supabase/supabase-js";

export function supabaseBrowser() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !anon) {
		throw new Error("Missing Supabase browser env vars");
	}
	return createClient(url, anon, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true,
		},
	});
}


