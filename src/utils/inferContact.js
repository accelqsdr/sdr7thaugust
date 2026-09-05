/**
 * Auto-infer persona and pitch_type from a contact's title and optional industry.
 * Returns only non-null values — caller decides whether to overwrite existing data.
 */

const PERSONA_RULES = [
  { pattern: /\b(ceo|chief executive|president|owner|founder|co-founder|managing director|md)\b/i, persona: 'Economic Buyer' },
  { pattern: /\b(cfo|chief financial|vp finance|vp of finance|finance director)\b/i, persona: 'Economic Buyer' },
  { pattern: /\b(coo|chief operating)\b/i, persona: 'Economic Buyer' },
  { pattern: /\b(cto|chief technology|chief technical|vp engineering|vp of engineering|head of engineering|engineering director|director of engineering)\b/i, persona: 'Technical Buyer' },
  { pattern: /\b(cio|chief information|vp it|head of it|it director|director of it|director of technology)\b/i, persona: 'Technical Buyer' },
  { pattern: /\b(vp (of )?quality|director (of )?quality|head of quality|quality director)\b/i, persona: 'Technical Buyer' },
  { pattern: /\b(qa|quality assurance|quality engineer|test engineer|sdet|software development engineer in test|automation engineer|test automation|testing engineer|qe lead|qa lead|qa manager|director of qa|head of qa|vp qa)\b/i, persona: 'QA Champion' },
  { pattern: /\b(engineering manager|software engineering manager|senior engineering manager)\b/i, persona: 'Technical Buyer' },
  { pattern: /\b(devops|platform engineer|release engineer|site reliability|sre)\b/i, persona: 'Technical Buyer' },
  { pattern: /\b(vp product|head of product|product director|chief product)\b/i, persona: 'Economic Buyer' },
  { pattern: /\b(product manager|product owner)\b/i, persona: 'Technical Buyer' },
];

const PITCH_TYPE_RULES = [
  { pattern: /\bsalesforce\b/i, pitch_type: 'Salesforce' },
  { pattern: /\bsap\b/i, pitch_type: 'SAP' },
  { pattern: /\boracle\b/i, pitch_type: 'Oracle' },
  { pattern: /\bservicenow\b/i, pitch_type: 'ServiceNow' },
  { pattern: /\bworkday\b/i, pitch_type: 'Workday' },
  { pattern: /\bdynamics\b/i, pitch_type: 'MS Dynamics' },
  { pattern: /\bpega\b/i, pitch_type: 'Pega' },
  { pattern: /\bncino\b/i, pitch_type: 'nCino' },
  { pattern: /\bcoupa\b/i, pitch_type: 'Coupa' },
];

const INDUSTRY_PITCH_RULES = [
  { pattern: /\b(bank|financial|fintech|insurance|capital|investment|asset management)\b/i, pitch_type: 'Financial Services' },
  { pattern: /\b(health|hospital|pharma|biotech|medical|clinical|life science)\b/i, pitch_type: 'Healthcare' },
  { pattern: /\b(telecom|telco|wireless|carrier|network operator)\b/i, pitch_type: 'Telecom' },
  { pattern: /\b(retail|ecommerce|e-commerce|consumer goods|fmcg)\b/i, pitch_type: 'Retail' },
  { pattern: /\b(it services|consulting|outsourc|managed service|system integrat)\b/i, pitch_type: 'IT Services' },
];

export function inferPersona(title) {
  if (!title) return null;
  for (const rule of PERSONA_RULES) {
    if (rule.pattern.test(title)) return rule.persona;
  }
  return null;
}

export function inferPitchType(title, industry) {
  const text = `${title || ''} ${industry || ''}`;
  for (const rule of PITCH_TYPE_RULES) {
    if (rule.pattern.test(text)) return rule.pitch_type;
  }
  for (const rule of INDUSTRY_PITCH_RULES) {
    if (rule.pattern.test(industry || '')) return rule.pitch_type;
  }
  return null;
}

export function inferFromTitle(title, industry) {
  return {
    persona: inferPersona(title),
    pitch_type: inferPitchType(title, industry),
  };
}
