// Smith — Resume PDF → structured profile pre-fill
//
// Pipeline:
//   PDF buffer → pdf-parse (text extraction) → Haiku 4.5 (extractResumeFromText)
//
// Returns the parsed JSON (matching RESUME_SCHEMA in llm.js). Does NOT write
// to the DB — the route hands the pre-fill back to the client, the user
// confirms in the interview UI, and only then do interview/step calls persist.
//
// Note: pdf-parse 1.1.1 has a known quirk where importing the package root
// triggers a debug code path that tries to read a test PDF at import time and
// crashes. The fix is to import from the inner module path.

import pdf from 'pdf-parse/lib/pdf-parse.js';
import { extractResumeFromText } from './llm.js';

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB — generous; resumes are tiny

export async function parseResumeBuffer(buf) {
  if (!Buffer.isBuffer(buf)) {
    const err = new Error('Expected a Buffer');
    err.status = 400;
    throw err;
  }
  if (buf.length > MAX_PDF_BYTES) {
    const err = new Error('PDF exceeds 10 MB');
    err.status = 413;
    throw err;
  }

  let result;
  try {
    result = await pdf(buf);
  } catch (e) {
    const err = new Error('Could not read PDF');
    err.status = 400;
    err.cause = e;
    throw err;
  }

  const text = (result?.text || '').trim();
  if (text.length < 80) {
    // Image-only / scanned PDF — pdf-parse only handles text PDFs. Surface a
    // clear message rather than letting the model hallucinate from nothing.
    const err = new Error('No selectable text found in PDF (was it scanned?)');
    err.status = 422;
    throw err;
  }

  return extractResumeFromText(text);
}
