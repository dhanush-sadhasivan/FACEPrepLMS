import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const body = await req.json()
  const { full_name, emp_email, hackerrank_id, leetcode_id } = body

  if (hackerrank_id && hackerrank_id.trim() !== '') {
    const cleanHr = hackerrank_id.trim();
    if (!['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(cleanHr.toLowerCase())) {
      try {
        const hrRes = await fetch(`https://www.hackerrank.com/rest/hackers/${encodeURIComponent(cleanHr)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          cache: 'no-store',
        });
        if (hrRes.status === 404) {
          return NextResponse.json({ error: `HackerRank ID "${cleanHr}" does not exist on HackerRank. Please enter a valid username.` }, { status: 400 });
        }
        if (hrRes.ok) {
          const hrData = await hrRes.json().catch(() => null);
          if (hrData?.status === false || (hrData && !hrData.model)) {
            return NextResponse.json({ error: `HackerRank ID "${cleanHr}" does not exist on HackerRank. Please enter a valid username.` }, { status: 400 });
          }
        }
      } catch {
        // silent fallback if HackerRank is unreachable
      }
    }
  }

  const updatePayload: Record<string, any> = { full_name, emp_email, hackerrank_id };
  if (leetcode_id !== undefined) {
    updatePayload.leetcode_id = leetcode_id ? leetcode_id.trim() : null;
  }

  const { data, error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', user.id)
    .select()
    .single()
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
