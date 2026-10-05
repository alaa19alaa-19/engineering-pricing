import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ogilnfkuznmlqodwmtsd.supabase.co'
const supabaseKey = 'sb_publishable_8Ez2ygXQTcZBKX97gp5wUQ_CHH-KzjA'

export const supabase = createClient(supabaseUrl, supabaseKey)