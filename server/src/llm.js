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

// ── Assisted apply (phase 4 stub) ──────────────────────────────────────────

export function assistedApplyEnabled() {
  // Default on. Set ASSISTED_APPLY_LLM=false in Render env to flip the kill
  // switch without a redeploy — callers fall back to a template draft.
  return process.env.ASSISTED_APPLY_LLM !== 'false';
}

export async function draftApplicationMessage(_profile, _job) {
  // Implemented in phase 4 alongside the jobs feed + application_drafts table.
  throw new Error('draftApplicationMessage is not implemented yet (phase 4)');
}
