import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STAGE_CONTEXT: Record<string, { label: string; intent: string; tone: string }> = {
  Fresh: {
    label: 'Initial cold email (Fresh)',
    intent: 'Very first outreach to this prospect. Establish relevance with one sharp, researched hook. One pain point, one proof, one low-friction CTA.',
    tone: 'Confident and concise. Lead with something specific about their world — never with "I" or "My name is".',
  },
  F1: {
    label: 'Initial outreach (F1)',
    intent: 'First cold email — establish relevance, hook with a specific insight, low-friction CTA.',
    tone: 'Confident but not pushy. Lead with their world, not yours.',
  },
  F2: {
    label: 'First follow-up (F2)',
    intent: 'No reply to F1. Add NEW value — a completely different angle, insight, or proof point. NEVER say "just following up" or "circling back".',
    tone: 'Warmer, a bit more direct. Try a new hook — industry stat, trigger event, or different pain point.',
  },
  F3: {
    label: 'Second follow-up (F3)',
    intent: 'Still no reply. Use social proof — a mini case study or result from their industry. Make the benefit concrete and tangible.',
    tone: 'Concise. One proof point. One simple question.',
  },
  F4: {
    label: 'Third follow-up (F4)',
    intent: 'Fourth touch. Try a completely different angle — a different pain point, or a question about their current approach. Be direct.',
    tone: 'Short and punchy. 3-4 sentences max. No filler.',
  },
  F5: {
    label: 'Break-up email (F5)',
    intent: 'Final touch. Politely close the loop. Give them an out but leave the door open. This often gets replies.',
    tone: 'Human, gracious, brief. No hard sell. Leave on a positive note.',
  },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { contact, stage, accountResearch, senderName, priorEmailBodies } = await req.json()
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const ctx = STAGE_CONTEXT[stage] || STAGE_CONTEXT.F1
    const research = accountResearch || {}

    // Build prior emails section if we have sent history
    const priorEmails = Array.isArray(priorEmailBodies) && priorEmailBodies.length > 0
      ? `\nPRIOR EMAILS ALREADY SENT (use a COMPLETELY DIFFERENT angle — never repeat the same hook, angle, or proof point):\n${priorEmailBodies.map((b, i) => `--- Email ${i + 1} ---\n${b}`).join('\n\n')}\n`
      : ''

    const prompt = `You are an expert SDR at ACCELQ, an AI-powered test automation platform helping QA teams move from manual/legacy testing to intelligent automation.

Write a cold outreach email for stage: ${ctx.label}

PROSPECT:
- Name: ${contact.full_name}
- Title: ${contact.title || 'unknown'}
- Company: ${contact.company}
- Email: ${contact.email || 'unknown'}
- Response so far: ${contact.response || 'no response yet'}
- SDR pitch notes: ${contact.pitch || 'none'}

ACCOUNT INTELLIGENCE:
- Industry: ${contact.industry || research.detectedIndustry || 'unknown'}
- Why target: ${research.whyTarget || 'strong fit for ACCELQ'}
- Pain points: ${research.painPoints || 'manual testing overhead, slow release cycles, legacy tools'}
- Tech stack: ${research.techStack || 'enterprise stack'}
- Recent news / triggers: ${research.recentNews || 'digital transformation'}
- Testing tools in use: ${(research.testingTools || []).join(', ') || 'unknown'}${priorEmails}
STAGE INSTRUCTIONS:
Intent: ${ctx.intent}
Tone: ${ctx.tone}

SENDER: ${senderName || 'Your SDR'}

RULES (non-negotiable):
- Subject: under 50 chars, specific, no spam words, no ALL CAPS
- Body: under 150 words total
- NEVER use: "I hope this finds you well", "just following up", "circling back", "touching base", "reaching out because", "I'm writing to"
- Open with THEM — a specific insight about their company, industry, or role — never with "I" or "My name is"
- ONE pain point · ONE proof point or insight · ONE CTA
- CTA = a low-friction question (e.g. "Worth a quick 15-min chat?") — never "book a demo on my Calendly"
- Plain text only — no bullets, no bold, no markdown in the body
- If prior emails exist above, use a completely fresh angle not used before

Return ONLY a valid JSON object with exactly two fields:
{"subject": "the subject line", "body": "full email body including greeting and sign-off"}`

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
