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
    const body = await req.json()
    const { account, sectionKey, sectionLabel, mode } = body
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured. Set it in Supabase → Settings → Edge Functions → Secrets.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── FULL RESEARCH MODE ──────────────────────────────────────────────────
    // Returns one JSON object with tools, enterpriseApps, saasApps, signals,
    // research text sections, and industry — mirrors the HTML's buildResearchPrompt
    if (mode === 'full') {
      const contactsText = (account.contacts || [])
        .slice(0, 5)
        .map((c: any) => `${c.full_name} (${c.title || 'unknown title'})`)
        .join(', ')

      const existingTools = (account.testing_tools || []).map((t: any) => t.tool).join(', ')
      const notes = account.notes || ''

      const fullPrompt = `You are an expert B2B sales researcher for ACCELQ, an AI-powered test automation platform.

Research this company for a sales intelligence brief:
Company: ${account.name}
Industry: ${account.industry || 'Unknown'}
Country: ${account.country || 'Unknown'}
Revenue: ${account.revenue_millions ? `$${account.revenue_millions}M` : 'Unknown'}
Known Contacts: ${contactsText || 'None'}
Existing Tools Recorded: ${existingTools || 'None'}
SDR Notes: ${notes || 'None'}

Return ONLY a valid JSON object (no markdown, no explanation) with exactly these fields:

{
  "why": "2-3 sentences on why this company is a strong ACCELQ target",
  "tech": "2-3 sentences on likely tech stack, CI/CD, cloud platform, test frameworks",
  "qaHiring": "1-2 sentences: Low/Medium/High likelihood of hiring QA/automation engineers with reason",
  "news": "1 relevant recent news item or digital transformation initiative",
  "pain": "Top 2 QA/testing pain points ACCELQ solves for this company",
  "tools": ["list", "of", "testing", "tools", "they", "likely", "use"],
  "funding": false,
  "hiringQA": false,
  "launch": false,
  "leadership": false,
  "outage": false,
  "cicd": false,
  "enterpriseApps": ["list", "of", "enterprise", "apps", "they", "use"],
  "detectedIndustry": "one of: Insurance|Banking|Healthcare|Retail|Manufacturing|Telecom|Technology|Other",
  "saasApps": ["list", "of", "industry-specific", "saas", "apps"],
  "about": "3-4 sentence overview of what this company does, who it serves, and its market position",
  "businessModel": "2-3 sentences on how this company generates revenue and its primary business model",
  "strategicPriorities": [{"title": "Priority 1 short name", "description": "2 sentence explanation"}, {"title": "Priority 2 short name", "description": "2 sentence explanation"}, {"title": "Priority 3 short name", "description": "2 sentence explanation"}]
}

Rules for tools array: ONLY include dedicated QA/test automation tools (e.g. Selenium, Cypress, Playwright, UFT, Tosca, JUnit, TestNG, Postman, k6, Appium, Robot Framework, Katalon, LoadRunner, JMeter, NUnit, PyTest). Do NOT include: programming languages (Java, Python, JavaScript, C#), build tools (Maven, Gradle, npm), CI/CD platforms (Jenkins, GitLab CI, GitHub Actions, CircleCI), infrastructure tools (Docker, Kubernetes, Terraform), or cloud providers (AWS, Azure, GCP).

Rules for boolean signals:
- funding: true if company recently raised funding or had IPO
- hiringQA: true if company is likely actively hiring QA/automation engineers  
- launch: true if company recently launched a major product
- leadership: true if company had recent leadership changes (new CTO/CIO/VP Eng)
- outage: true if company had recent quality incidents or outages
- cicd: true if company has active CI/CD pipeline culture

Rules for enterpriseApps: List major enterprise apps they likely run (SAP, Oracle, Salesforce, Workday, ServiceNow, etc.)

Rules for saasApps — use detected industry to pick relevant apps:
- Insurance: Guidewire, Duck Creek, Majesco, Sapiens, Fineos
- Banking/Financial Services: Temenos, Finastra, Murex, Flexcube, FIS, Fiserv
- Healthcare: Epic, Cerner, Meditech, Allscripts, NextGen
- Retail: Shopify, SAP Commerce, Salesforce Commerce, Manhattan Associates
- Manufacturing: PTC, Siemens PLM, Infor, AVEVA
- Telecom: Amdocs, CSG, Netcracker, Oracle Communications
- Technology: Jira, Confluence, GitHub, Okta, Snowflake

Keep all arrays to 3-6 items max. Be specific and realistic for this company's size and industry.`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1200,
          messages: [{ role: 'user', content: fullPrompt }]
        })
      })

      const aiData = await response.json()
      const rawText = aiData.content?.[0]?.text || '{}'

      // Parse JSON — strip any accidental markdown fences
      let parsed: any = {}
      try {
        const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
        parsed = JSON.parse(cleaned)
      } catch {
        // If parse fails return error so caller can surface it
        return new Response(JSON.stringify({ error: 'AI returned invalid JSON', raw: rawText }), {
          status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ full: parsed }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── SINGLE SECTION MODE (existing behaviour) ────────────────────────────
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
