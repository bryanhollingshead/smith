// Smith — Linear adapter
//
// Single seam between Smith's feedback Signal payload and Linear's GraphQL
// API. The widget never talks to Linear; the /api/feedback route calls
// createSignalInLinear(signal, pngBuffer) and gets back { issueUrl }.
// Swapping to GitHub Issues or an internal store later is a one-function
// change — the widget and route never need to know.
//
// Linear personal API keys: Authorization header is the raw key (no `Bearer`
// prefix). File upload is two-phase: fileUpload mutation → PUT bytes to the
// returned presigned URL with the headers Linear hands back. Client-side
// upload is blocked by Linear's CSP, so the PUT must happen server-side.

const LINEAR_GRAPHQL = 'https://api.linear.app/graphql';

function envOrThrow(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

function envOrNull(name) {
  return process.env[name] || null;
}

async function linearGql(query, variables) {
  const res = await fetch(LINEAR_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: envOrThrow('LINEAR_API_KEY'),
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Linear GraphQL ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Linear GraphQL error: ${JSON.stringify(json.errors).slice(0, 400)}`);
  }
  return json.data;
}

// fileUpload returns { success, uploadFile: { uploadUrl, assetUrl, headers[] } }.
// We turn the array of {key, value} into a real Headers object before the PUT.
async function uploadPngToLinear(buffer, filename) {
  const data = await linearGql(
    `mutation FileUpload($size: Int!, $contentType: String!, $filename: String!) {
       fileUpload(size: $size, contentType: $contentType, filename: $filename) {
         success
         uploadFile {
           uploadUrl
           assetUrl
           headers { key value }
         }
       }
     }`,
    {
      size: buffer.byteLength,
      contentType: 'image/png',
      filename,
    }
  );
  if (!data.fileUpload?.success || !data.fileUpload.uploadFile) {
    throw new Error('Linear fileUpload returned no uploadFile');
  }
  const { uploadUrl, assetUrl, headers = [] } = data.fileUpload.uploadFile;

  const h = new Headers();
  h.set('Content-Type', 'image/png');
  h.set('Cache-Control', 'public, max-age=31536000');
  for (const { key, value } of headers) h.set(key, value);

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: h,
    body: buffer,
    signal: AbortSignal.timeout(30_000),
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => '');
    throw new Error(`Linear asset PUT ${putRes.status}: ${text.slice(0, 200)}`);
  }
  return { assetUrl };
}

// Build the Linear issue title from a Signal. Short, type-tagged, derived
// from the first line of the comment.
function buildTitle(signal) {
  const first = (signal.comment || '').split(/\r?\n/)[0].trim() || '(no description)';
  const trimmed = first.length > 80 ? first.slice(0, 79) + '…' : first;
  return `[${signal.type}] ${trimmed}`;
}

// Markdown description: structured so a human triaging in Linear sees the
// what+where at a glance, and an LLM agent can parse the same data later.
function buildDescription(signal, assetUrl) {
  const ctx = signal.context || {};
  const lines = [];

  lines.push(signal.comment?.trim() || '_No comment provided._');
  lines.push('');

  if (signal.helpRequest) {
    lines.push('### Get-help request');
    lines.push(signal.helpRequest.trim());
    lines.push('');
  }

  if (assetUrl) {
    lines.push('### Screenshot');
    lines.push(`![screenshot](${assetUrl})`);
    lines.push('');
  }

  lines.push('### Context');
  const row = (k, v) => v != null && v !== '' ? `- **${k}:** ${v}` : null;
  const ctxLines = [
    row('Source', signal.source),
    row('User', ctx.userName ? `${ctx.userName} (id ${ctx.userId})` : ctx.userId),
    row('Role', ctx.role),
    row('Route', ctx.route),
    row('URL', ctx.url),
    row('Viewport', ctx.viewport ? `${ctx.viewport.w}×${ctx.viewport.h}` : null),
    row('App version', ctx.appVersion),
    row('User agent', ctx.userAgent),
    row('Timestamp', ctx.timestamp),
  ].filter(Boolean);
  lines.push(ctxLines.join('\n'));

  return lines.join('\n');
}

// Map the Signal fields to Linear label IDs from env. Missing IDs are
// silently dropped so an undeclared label doesn't blow up an issue create.
function labelIdsFor(signal) {
  const sourceKey = signal.source === 'pm' ? 'LINEAR_LABEL_PM' : 'LINEAR_LABEL_CUSTOMER';
  const typeKey = ({
    bug:      'LINEAR_LABEL_BUG',
    idea:     'LINEAR_LABEL_IDEA',
    question: 'LINEAR_LABEL_QUESTION',
    other:    'LINEAR_LABEL_OTHER',
  })[signal.type];
  return [envOrNull(sourceKey), envOrNull(typeKey)].filter(Boolean);
}

export async function createSignalInLinear(signal, pngBuffer) {
  const teamId = envOrThrow('LINEAR_TEAM_ID');

  let assetUrl = null;
  if (pngBuffer && pngBuffer.byteLength > 0) {
    const filename = `signal-${Date.now()}.png`;
    const up = await uploadPngToLinear(pngBuffer, filename);
    assetUrl = up.assetUrl;
  }

  const data = await linearGql(
    `mutation IssueCreate($input: IssueCreateInput!) {
       issueCreate(input: $input) {
         success
         issue { id identifier url title }
       }
     }`,
    {
      input: {
        teamId,
        title: buildTitle(signal),
        description: buildDescription(signal, assetUrl),
        labelIds: labelIdsFor(signal),
      },
    }
  );
  if (!data.issueCreate?.success || !data.issueCreate.issue) {
    throw new Error('Linear issueCreate returned no issue');
  }
  const issue = data.issueCreate.issue;
  return { issueId: issue.id, issueUrl: issue.url, identifier: issue.identifier };
}
