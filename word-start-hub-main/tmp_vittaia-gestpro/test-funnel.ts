import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

const supUrl = process.env.VITE_SUPABASE_URL || ''
const supKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const supabase = createClient(supUrl, supKey)

async function run() {
    const { data, error } = await supabase
        .from('chat_funnel_stage')
        .select('*, funnels(name), funnel_stages(name, color)')
        .limit(3)
    console.log("Error:", error)
    console.log("Data:", JSON.stringify(data, null, 2))
}
run()
