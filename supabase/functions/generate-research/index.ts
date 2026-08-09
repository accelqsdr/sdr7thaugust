import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { account, sectionKey, sectionLabel } = await req.json()
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured. Set it in Supabase → Settings → Edge Functions → Secrets.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const sectionPrompts: Record<string, string> = {
      whyTarget: `Why is ${account.name} a strong target for ACCELQ (AI-powered test automation)? Consider their size, industry, and likely QA maturity. Be specific and actionable in 2-3 sentences.`,
      techStack: `What is the likely tech stack, CI/CD tools, cloud platform, and testing frameworks at ${account.name} (${account.industry || 'tech company'}, ${account.country || 'unknown country'})? Be specific about technologies that indicate test automation opportunities.`,
      qaHiring: `Based on typical hiring patterns for a ${account.industry || 'technology'} company like ${account.name}, assess their QA hiring signals. Are they likely to be growing their QA/automation team? Rate as Low/Medium/High with 1-2 reasons.`,
      recentNews: `What is a likely recent news item, initiative, or development at ${account.name} (${account.industry || 'tech'} company in ${account.country || 'unknown region'}) relevant to digital transformation or software quality? Focus on items that create test automation urgency.`,
      painPoints: `What are the top 2 QA/testing pain points that ${account.name} (${account.industry || 'technology'} company) likely faces? Focus on problems ACCELQ's AI test automation directly solves — such as manual testing overhead, legacy tool limitations, slow release cycles, or compliance testing needs.`,
    }

    const prompt = sectionPrompts[sectionKey] || 
      `Research the "${sectionLabel}" for ${account.name}, a ${account.industry || 'technology'} company in ${account.country || 'unknown location'}. Keep it relevant to test automation and QA. 2-3 sentences.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const aiData = await response.json()
    const text = aiData.content?.[0]?.text || ''

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
