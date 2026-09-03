import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STAGE_CONTEXT: Record<string, { label: string; intent: string; tone: string }> = {
  Fresh: {
    label: 'Initial cold email (Fresh)',
    intent: 'Very first outreach. Open with a hyper-specific observation about their company, role, or industry that proves you have done your homework. Name a pain point they almost certainly feel given their context. One proof point. One low-friction CTA.',
    tone: 'Sharp, direct, confident. Every sentence earns its place.',
  },
  F1: {
    label: 'Initial outreach (F1)',
    intent: 'First cold email. Open with something specific about them - a trigger event, a known pain for their role, or a sharp industry insight. Never be generic.',
    tone: 'Confident but not pushy. Lead with their world, not yours.',
  },
  F2: {
    label: 'First follow-up (F2)',
    intent: 'No reply to F1. Open with a completely different angle - a new insight, a different pain point, or something about their industry right now. NEVER say "just following up" or "circling back". Add genuine new value.',
    tone: 'Warmer, a bit more direct. One fresh hook, one proof point, one CTA.',
  },
  F3: {
    label: 'Second follow-up (F3)',
    intent: 'Still no reply. Lead with a specific result from a similar company in their industry. Make it concrete - name the outcome, the timeframe, the before/after. One simple question to close.',
    tone: 'Concise. Let the proof point do the talking.',
  },
  F4: {
    label: 'Third follow-up (F4)',
    intent: 'Fourth touch. Ask a direct, genuine question about how they currently handle the problem ACCELQ solves. No pitch yet - just curiosity.',
    tone: 'Short and human. 3-4 sentences max. Feels like a real person wrote it.',
  },
  F5: {
    label: 'Break-up email (F5)',
    intent: 'Final touch. Acknowledge you have reached out a few times. Leave them with one useful insight specific to their world. Close the loop gracefully and leave the door open.',
    tone: 'Human, gracious, brief. No hard sell.',
  },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { contact, stage, accountResearch, senderName, priorEmailBodies, customPrompt } = await req.json()
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const ctx = STAGE_CONTEXT[stage] || STAGE_CONTEXT.F1
    const research = accountResearch || {}

    const priorEmails = Array.isArray(priorEmailBodies) && priorEmailBodies.length > 0
      ? `\nPRIOR EMAILS SENT (use a COMPLETELY DIFFERENT angle - different hook, different pain point, different proof):\n${priorEmailBodies.map((b: string, i: number) => `--- Email ${i + 1} ---\n${b}`).join('\n\n')}\n`
      : ''

    const customInstructions = customPrompt?.trim()
      ? `\nSDR CUSTOM INSTRUCTIONS (follow these exactly, they override everything else):\n${customPrompt.trim()}\n`
      : ''

    const prompt = `You are an elite SDR at ACCELQ, an AI-powered test automation platform. ACCELQ helps QA teams eliminate manual testing and fragile scripts with self-healing, codeless automation. Real results: teams cut test maintenance by 60-90% and shrink release cycles from weeks to days.

Write a cold email for stage: ${ctx.label}

ABOUT THIS PROSPECT:
- Name: ${contact.full_name}
- Title: ${contact.title || 'unknown'}
- Company: ${contact.company}
- Industry: ${contact.industry || research.detectedIndustry || 'unknown'}
- Response so far: ${contact.response || 'no response yet'}
- SDR notes / pitch angle: ${contact.pitch || 'none'}

ACCOUNT INTELLIGENCE (use this to personalize):
- Why we target them: ${research.whyTarget || 'strong fit for ACCELQ'}
- Their likely pain points: ${research.painPoints || 'manual testing overhead, slow release cycles, legacy scripts'}
- Tech / testing tools they use: ${(research.testingTools || []).join(', ') || research.techStack || 'unknown'}
- Recent news or trigger: ${research.recentNews || 'none'}${priorEmails}${customInstructions}

STAGE GOAL:
${ctx.intent}

TONE:
${ctx.tone}

SENDER: ${senderName || 'Your SDR'}

OPENING LINE RULES (most important):
- The first sentence must be about THEM specifically - their company, their industry challenge, their role, a recent trigger event, or something they would recognise as true about their world
- Never open with "I", "My name is", "I hope", "We at ACCELQ", or any version of introducing yourself
- Never open with a generic statement that could apply to any company
- Good example: "Scaling a QA function in fintech while keeping up with weekly releases is one of the hardest operational problems in the space."
- Good example: "Most enterprise QA teams I speak with at [company-size] companies are spending 40-60% of their sprint time just maintaining test scripts rather than writing new ones."
- Bad example: "I came across your profile and thought ACCELQ could be a great fit."

BODY RULES:
- One specific pain point tied to their context (industry, tools, company size, or role)
- One concrete proof point - name a result, a number, a timeframe (e.g. "one retail bank cut regression time from 3 weeks to 4 days")
- One CTA: a low-friction question like "Worth a quick 15-min call?" - never a Calendly link
- 80-120 words total for the body
- Plain text only - no bullets, no bold, no formatting

ABSOLUTE RULES:
- Never use em dashes or en dashes - use commas or plain hyphens
- Never say: "I hope this finds you well", "just following up", "circling back", "touching base", "reaching out because", "I wanted to"
- Never use vague claims - every statement must be specific
- Subject line: under 50 characters, specific, no spam words, no ALL CAPS

Return ONLY a valid JSON object:
{"subject": "subject line here", "body": "full email body with greeting and sign-off"}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 700,
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

    const clean = (s: string) => (s || '')
      .replace(/[—–]/g, '')
      .replace(/  +/g, ' ')
      .trim()

    return new Response(JSON.stringify({ subject: clean(parsed.subject), body: clean(parsed.body) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
