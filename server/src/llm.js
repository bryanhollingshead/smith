// Smith — Anthropic SDK wrapper
//
// Two callers:
//   1. extractResumeFromText  (Haiku 4.5)  — structured resume extraction via
//      output_config.format (json_schema). Used by /api/profiles/me/resume/parse.
//   2. draftApplicationMessage (Sonnet 4.6) — phase 4 stub for assisted apply.
//      Gated by env flag ASSISTED_APPLY_LLM ("false" turns the LLM path off and
//      the caller falls back to a deterministic template draft).
//
// Key choices:
//   - Lazy client init so the server can boot without ANTHROPIC_API_KEY set
//     (only callers that hit the LLM endpoints will error).
//   - Caching: the long system prompt + schema sit in a cache_control block so
//     repeated extractions ride the prefix cache on Haiku 4.5 (min prefix 4096
//     tokens — we may or may not clear that bar with phase 1 prompts, no harm
//     either way).
//   - Output is constrained via output_config.format (json_schema), which
//     deprecates the old output_format param. Haiku 4.5 supports this.

import Anthropic from '@anthropic-ai/sdk';

export const HAIKU  = 'claude-haiku-4-5';
export const SONNET = 'claude-sonnet-4-6';

let _client = null;
function client() {
  if (_client) return _client;
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error('ANTHROPIC_API_KEY not set');
    err.status = 503;
    err.publicMessage = 'Resume parsing is not configured on this server.';
    throw err;
  }
  _client = new Anthropic(); // reads ANTHROPIC_API_KEY
  return _client;
}

// ── Resume extraction ──────────────────────────────────────────────────────
//
// Schema mirrors Smith's DB shape: headline / about / location / years +
// canonical sub-lists for trades, skills, licenses, work_history. Everything
// is REQUIRED so the model returns the keys (with `null`/empty arrays when
// not in the resume) — easier to handle than missing keys.
//
// Constraints supported by structured outputs (per the Claude API skill):
// - additionalProperties: false (required on every object)
// - enum, const, anyOf, allOf, $ref/$def
// - Basic types
// NOT supported: minLength/maxLength, minimum/maximum, multipleOf, complex
// array constraints. We rely on the model + downstream validation instead.

const RESUME_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline:        { type: 'string',  description: 'One-line professional tagline (e.g. "Master electrician — Salt Lake City"). Empty string if not derivable.' },
    about:           { type: 'string',  description: 'Short 2-4 sentence bio in first person. Empty string if not derivable.' },
    location:        { type: 'string',  description: 'City, ST (e.g. "Salt Lake City, UT"). Empty string if not in the resume.' },
    years_experience:{ type: 'integer', description: 'Years of trades experience. 0 if not in the resume.' },
    trades: {
      type: 'array',
      description: 'Trades the person practices. Pull from explicit trade mentions; first element is the primary trade.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name:  { type: 'string',  description: 'Trade name. Prefer canonical Smith names: Electrical, Carpentry, Plumbing, HVAC, Concrete & Masonry, Roofing, Painting & Finishing, Tile & Flooring, General Contracting, Project Management, Stonemasonry, Cabinetry. Otherwise use the resume\'s exact wording.' },
          years: { type: 'integer', description: 'Years in this trade. 0 if not specified.' },
        },
        required: ['name', 'years'],
      },
    },
    skills: {
      type: 'array',
      description: 'Specific skills/competencies (e.g. "Service upgrades", "Custom millwork"). Prefer concrete job-types over generic verbs.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name:  { type: 'string' },
          level: { type: 'integer', enum: [1,2,3,4,5], description: 'Self-assessed level 1-5. Default 3 when unclear.' },
        },
        required: ['name', 'level'],
      },
    },
    licenses: {
      type: 'array',
      description: 'Licenses/certifications/credentials (e.g. journeyman license, OSHA 30). Skip if no number is given.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name:       { type: 'string' },
          number:     { type: 'string', description: 'License number as it appears in the resume.' },
          expiration: { type: 'string', description: 'YYYY-MM format. If only a year is given, use YYYY-12. If unknown, use a far-future placeholder like 2099-12.' },
        },
        required: ['name', 'number', 'expiration'],
      },
    },
    work_history: {
      type: 'array',
      description: 'Roles in reverse-chronological order (most recent first). Skip entries with no company name.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          company_name: { type: 'string' },
          role:         { type: 'string', description: 'Job title.' },
          from_year:    { type: 'string', description: 'Start year as YYYY.' },
          to_year:      { type: 'string', description: 'End year as YYYY, or empty string if current.' },
          is_current:   { type: 'boolean' },
        },
        required: ['company_name', 'role', 'from_year', 'to_year', 'is_current'],
      },
    },
  },
  required: ['headline', 'about', 'location', 'years_experience', 'trades', 'skills', 'licenses', 'work_history'],
};

const RESUME_SYSTEM_PROMPT = `You extract structured profile data from a tradesperson's resume for Smith, a construction-trades network.

Be conservative — return only what is explicitly in the resume text. Do NOT invent companies, dates, license numbers, or skills. If a field is not present, use the empty default specified in the schema (empty string, 0, empty array). Better to under-extract than to fabricate.

Special rules:
- headline: derive a single line from the resume's most senior role + primary trade + location if available; otherwise empty string.
- about: synthesize a brief 2-4 sentence first-person bio ONLY from facts in the resume (years, trade, notable projects). If you can't, return empty string.
- trades: prefer the canonical Smith names listed in the schema description when the resume's term clearly maps to one. Years per trade default to 0 if not specified.
- licenses: only include credentials that have a number. A bare "OSHA trained" with no number → skip.
- work_history: reverse-chronological. is_current = true when the resume says "present" / "current" or the end date is missing for the most recent role.
- Trim PDF artifacts (page numbers, headers, repeated whitespace) when interpreting the text.`;

export async function extractResumeFromText(text) {
  if (!text || typeof text !== 'string') {
    const err = new Error('No resume text to extract from');
    err.status = 400;
    throw err;
  }
  // Cap input — resumes are short and we don't want a runaway PDF flooding
  // the model. 30K chars ≈ 7-8K tokens, well under Haiku 4.5's 200K context.
  const trimmed = text.length > 30000 ? text.slice(0, 30000) : text;

  const response = await client().messages.create({
    model: HAIKU,
    max_tokens: 4000,
    system: [
      {
        type: 'text',
        text: RESUME_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    output_config: {
      format: { type: 'json_schema', schema: RESUME_SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: `RESUME TEXT:\n\n${trimmed}\n\nExtract structured profile data per the schema.`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    const err = new Error('Model refused to process the resume');
    err.status = 422;
    throw err;
  }

  const block = response.content.find(b => b.type === 'text');
  if (!block?.text) {
    const err = new Error('Model returned no text content');
    err.status = 502;
    throw err;
  }
  try {
    return JSON.parse(block.text);
  } catch (e) {
    const err = new Error('Model returned invalid JSON');
    err.status = 502;
    err.cause = e;
    throw err;
  }
}

// ── Assisted apply (phase 4) ──────────────────────────────────────────────

export function assistedApplyEnabled() {
  // Default on. Set ASSISTED_APPLY_LLM=false in Render env to flip the kill
  // switch without a redeploy — callers fall back to a template draft.
  return process.env.ASSISTED_APPLY_LLM !== 'false';
}

// Stable system prompt — kept first so it sits in the cache_control prefix.
// Re-drafts on the same model hit the cache; per-draft cost drops from
// ~$0.005 to ~$0.001 (Sonnet 4.6 pricing). The instructions stay the same
// regardless of profile/job, so caching just works.
const APPLY_SYSTEM_PROMPT = `You write short, professional outreach messages from tradespeople (carpenters, electricians, plumbers, masons, HVAC techs, etc.) to potential employers about specific job postings.

Style:
- Direct and trades-real. Skip filler like "I'm thrilled to apply" or "exciting opportunity."
- Lead with concrete experience: years in the trade + a recent role or jobsite.
- Address the recipient by company name if known, otherwise "Hi there,".
- Keep it 90-160 words, plain text only. No markdown. No bullet points unless you're listing 2-3 recent jobsites.
- Sign off with the tradesperson's FIRST NAME only.

Hard rules:
- Use only facts from the profile. Never invent companies, dates, license numbers, or credentials.
- Do not fabricate ties ("I've always admired your work on …") unless the profile actually mentions them.
- Do not promise availability dates the profile doesn't claim.
- One paragraph each, roughly: who I am · why this role · what I'd bring · how to reach me.
- Match wording to the trade (e.g., an electrician says "service upgrade," not "electrical project").`;

function summarizeProfileForApply(profile) {
  const lines = [];
  lines.push(`Name: ${profile.name || 'Unknown'}`);
  if (profile.first_name) lines.push(`First name (for sign-off): ${profile.first_name}`);
  if (profile.headline)   lines.push(`Headline: ${profile.headline}`);
  if (profile.location)   lines.push(`Location: ${profile.location}`);
  if (profile.years_experience) lines.push(`Years in trades: ${profile.years_experience}`);
  if (profile.about)      lines.push(`About: ${profile.about}`);

  if (profile.trades?.length) {
    const list = profile.trades.map(t => `${t.name}${t.years ? ` (${t.years}y)` : ''}`).join(', ');
    lines.push(`Trades: ${list}`);
  }

  if (profile.work_history?.length) {
    lines.push('Recent work:');
    for (const w of profile.work_history.slice(0, 4)) {
      const dates = w.is_current ? `${w.from_year}–present` : `${w.from_year}–${w.to_year || '?'}`;
      lines.push(`  - ${w.role} at ${w.company_name} (${dates})`);
    }
  }

  // Pull up to 3 notable jobsites for concrete name-drops.
  const jobsites = (profile.work_history || []).flatMap(w => w.jobsites || []).slice(0, 3);
  if (jobsites.length) {
    lines.push('Notable jobsites:');
    for (const j of jobsites) {
      const bits = [j.title, j.location, j.year].filter(Boolean).join(' · ');
      lines.push(`  - ${bits}`);
    }
  }

  if (profile.licenses?.length) {
    const list = profile.licenses
      .map(l => `${l.name} #${l.number}`)
      .join(', ');
    lines.push(`Credentials: ${list}`);
  }

  if (profile.email)      lines.push(`Email: ${profile.email}`);
  return lines.join('\n');
}

function summarizeJobForApply(job) {
  const lines = [];
  lines.push(`Title: ${job.title}`);
  if (job.company)  lines.push(`Company: ${job.company}`);
  if (job.location) lines.push(`Location: ${job.location}`);
  if (job.salary_min || job.salary_max) {
    const m = (n) => '$' + Math.round(Number(n)).toLocaleString();
    const per = job.salary_period === 'hour' ? '/hr' : '/yr';
    const range = job.salary_min && job.salary_max && job.salary_min !== job.salary_max
      ? `${m(job.salary_min)}-${m(job.salary_max)}${per}`
      : `${m(job.salary_max || job.salary_min)}${per}`;
    lines.push(`Salary: ${range}${job.salary_is_predicted ? ' (estimated)' : ''}`);
  }
  if (job.description) {
    // Trim description — model doesn't need 8KB of body copy.
    const trimmed = job.description.length > 1500 ? job.description.slice(0, 1500) + '…' : job.description;
    lines.push(`Description: ${trimmed}`);
  }
  return lines.join('\n');
}

// Deterministic fallback when the LLM flag is off OR the LLM call fails.
// Same shape as the model output (plain text, 90-160 words) so the UI is
// identical either way. The model's loss is the user's loss — but we still
// give them a serviceable draft they can edit.
export function templateDraftFallback(profile, job) {
  const name = profile.first_name || (profile.name || '').split(' ')[0] || 'Smith member';
  const greeting = job.company ? `Hi ${job.company} team,` : 'Hi there,';
  const trade = profile.trades?.[0]?.name || 'tradesperson';
  const yearsBit = profile.years_experience ? ` with ${profile.years_experience} years in the trade` : '';
  const locBit = profile.location ? ` based in ${profile.location}` : '';

  const recent = (profile.work_history || []).slice(0, 2)
    .map(w => `${w.role} at ${w.company_name}`)
    .join(', ');
  const recentBit = recent
    ? ` Most recently: ${recent}.`
    : '';

  const credBit = (profile.licenses && profile.licenses.length)
    ? ` Licensed ${profile.licenses.map(l => l.name).join(', ')}.`
    : '';

  const contact = profile.email
    ? `You can reach me at ${profile.email}.`
    : `Reply here and I'll be in touch.`;

  return [
    greeting,
    '',
    `I'm ${name}, a ${trade}${yearsBit}${locBit}. I saw your "${job.title}" listing and wanted to reach out.${recentBit}${credBit}`,
    '',
    `Happy to share more about specific projects relevant to this role. ${contact}`,
    '',
    'Thanks,',
    name,
  ].join('\n');
}

// Generate an outreach draft. Returns { body, model }:
//   - body  → the draft text (plain string)
//   - model → 'claude-sonnet-4-6' on success, null on template fallback
//
// Never throws — the caller (route handler) gets a usable draft either way.
// LLM errors are logged + fallback used.
export async function draftApplicationMessage(profile, job) {
  if (!assistedApplyEnabled() || !process.env.ANTHROPIC_API_KEY) {
    return { body: templateDraftFallback(profile, job), model: null };
  }

  const userMsg =
    `PROFILE\n${summarizeProfileForApply(profile)}\n\n` +
    `JOB\n${summarizeJobForApply(job)}\n\n` +
    `Write the outreach now. Plain text. 90-160 words. Sign off with the first name only.`;

  try {
    const response = await client().messages.create({
      model: SONNET,
      max_tokens: 600,
      // effort is supported on Sonnet 4.6 — keep it medium for outreach
      // drafting. high overshoots cost without quality gain at this length.
      output_config: { effort: 'medium' },
      system: [
        {
          type: 'text',
          text: APPLY_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMsg }],
    });

    if (response.stop_reason === 'refusal') {
      console.warn('[llm] draftApplicationMessage refused; using template fallback');
      return { body: templateDraftFallback(profile, job), model: null };
    }
    const block = response.content.find(b => b.type === 'text');
    const body = block?.text?.trim();
    if (!body) {
      console.warn('[llm] draftApplicationMessage returned empty body; using template fallback');
      return { body: templateDraftFallback(profile, job), model: null };
    }
    return { body, model: SONNET };
  } catch (e) {
    console.error('[llm] draftApplicationMessage failed:', e.message || e);
    return { body: templateDraftFallback(profile, job), model: null };
  }
}
