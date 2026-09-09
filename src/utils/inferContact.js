/**
 * Auto-infer persona and pitch_type from a contact's title and optional industry.
 * Returns only non-null values — caller decides whether to overwrite existing data.
 */

const PERSONA_RULES = [
  // 1. Executive / Economic Buyer
  { pattern: /\b(cio|chief information officer|cto|chief technology officer|chief technical officer|chief digital officer|vp technology|vp of technology|svp technology|svp of technology|cfo|chief financial officer)\b/i, persona: 'Executive / Economic Buyer' },
  // 4. Automation / Technical Expert (checked before broader leader terms to catch specific architect/lead titles)
  { pattern: /\b(head of test automation|test automation manager|automation architect|qa architect|test architect|sdet lead)\b/i, persona: 'Automation / Technical Expert' },
  // 5. DevOps / Transformation / Architecture
  { pattern: /\b(vp devops|vp of devops|head of devops|devops director|enterprise architect|solution architect|solutions architect|digital transformation leader|digital transformation lead|digital transformation manager|digital transformation director)\b/i, persona: 'DevOps / Transformation / Architecture' },
  // 2. QA / Quality Leader
  { pattern: /\b(vp qa|vp of qa|vp quality engineering|vp of quality engineering|head of qa|head of qe|director qa|director of qa|director qe|director of qe|qa manager)\b/i, persona: 'QA / Quality Leader' },
  // 3. Engineering Leader
  { pattern: /\b(vp engineering|svp engineering|vp of engineering|svp of engineering|head of engineering|director engineering|director of engineering|engineering manager)\b/i, persona: 'Engineering Leader' },
  // 6. Practitioner / End User
  { pattern: /\b(sdet|qa engineer|automation engineer|test engineer|quality engineer|qa analyst)\b/i, persona: 'Practitioner / End User' },
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
  return null;
}

export function inferFromTitle(title, industry) {
  return {
    persona: inferPersona(title),
    pitch_type: inferPitchType(title, industry),
  };
}
