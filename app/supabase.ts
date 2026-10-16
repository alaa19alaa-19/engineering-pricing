import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://ogilnfkuznmlqodwmtsd.supabase.co";

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_8Ez2ygXQTcZBKX97gp5wUQ_CHH-KzjA";

export const supabase = createClient(supabaseUrl, supabaseKey);