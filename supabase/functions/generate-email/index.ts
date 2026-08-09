import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Stage descriptions for context
const STAGE_CONTEXT: Record<string, { label: string; intent: string; tone: string }> = {
  F1: {
    label: 'Initial outreach (F1)',
    intent: 'First cold email — establish relevance, hook with a specific insight, low-friction CTA',
    tone: 'Confident but not pushy. Lead with their world, not yours.',
  },
  F2: {
    label: 'First follow-up (F2)',
    intent: 'They did not reply to F1. Add new value — a different angle, insight, or proof point. Do NOT say "just following up".',
    tone: 'Warmer, a bit more direct. Reference a real trigger if possible.',
  },
  F3: {
    label: 'Second follow-up (F3)',
    intent: 'Still no reply. Social proof or a mini case study from their industry. Make the benefit concrete.',
    tone: 'Concise. One proof point. One question.',
  },
  F4: {
    label: 'Third follow-up (F4)',
    intent: 'Fourth touch. Try a completely different angle — a different pain point or a different persona insight.',
    tone: 'Short and punchy. 3-4 sentences max.',
  },
  F5: {
    label: 'Break-up email (F5)',
    intent: 'Final touch. Politely close the loop. Give them an out but leave the door open.',
    tone: 'Human, gracious, brief. No hard sell. Sometimes gets the reply the others did not.',
  },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { contact, stage, accountResearch, senderName } = await req.json()
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const ctx = STAGE_CONTEXT[stage] || STAGE_CONTEXT.F1
    const research = accountResearch || {}

    const prompt = `You are an expert SDR at ACCELQ, an AI-powered test automation platform that helps QA teams move from manual/legacy testing to AI-driven automation.

Write a cold outreach email for stage: ${ctx.label}

PROSPECT:
- Name: ${contact.full_name}
- Title: ${contact.title || 'unknown title'}
- Company: ${contact.company}
- Email: ${contact.email || 'unknown'}
- Response so far: ${contact.response || 'no response'}
- SDR Pitch notes: ${contact.pitch || 'none'}

ACCOUNT INTELLIGENCE:
- Industry: ${contact.industry || research.industry || 'unknown'}
- Why target: ${research.whyTarget || 'good fit for ACCELQ'}
- Pain points: ${research.painPoints || 'manual testing overhead, legacy tools, slow release cycles'}
- Tech stack: ${research.techStack || 'enterprise tech stack'}
- Recent news: ${research.recentNews || 'digital transformation initiatives'}

STAGE INSTRUCTIONS:
Intent: ${ctx.intent}
Tone: ${ctx.tone}

SENDER: ${senderName || 'Your SDR'}

RULES (follow strictly):
- Subject line: under 50 chars, specific, no spam words
- Body: under 150 words total
- NO "I hope this finds you well", "I'm reaching out because", "just following up", "touching base"
- Start with THEM — an insight about their company, industry, or role
- ONE pain point, ONE proof point or insight, ONE CTA
- CTA must be a low-friction question (not "book a demo")
- Plain text only — no bullets, no bold, no markdown
- Sign off with sender name only

Return ONLY a JSON object with exactly two fields:
{
  "subject": "the subject line",
  "body": "the full email body including greeting and sign-off"
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const aiData = await response.json()
    const rawText = aiData.content?.[0]?.text || '{}'

    let parsed: any = {}
    try {
      const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return new Response(JSON.stringify({ error: 'AI returned invalid JSON', raw: rawText }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ subject: parsed.subject || '', body: parsed.body || '' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
