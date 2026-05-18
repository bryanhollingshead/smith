// Smith — Auth helpers
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

export const hashPassword = (pw) => bcrypt.hash(pw, 10);
export const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);

export const signToken = (payload) =>
  jwt.sign(payload, SECRET, { expiresIn: EXPIRES });

export const verifyToken = (token) => jwt.verify(token, SECRET);

/** 6-digit numeric verification code, zero-padded. */
export const make6DigitCode = () =>
  String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

/** URL-safe random token for password resets. */
export const makeResetToken = () =>
  crypto.randomBytes(32).toString('base64url');

/** Score 1..4 used by the password strength bar. Mirrors UX, not crypto. */
export function passwordStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/\d/.test(pw) && /[a-zA-Z]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw) || pw.length >= 16) score++;
  return Math.min(4, score);
}

/** Server-side validation matching the UI rule: 12+ chars, 1 number. */
export function validatePassword(pw) {
  if (typeof pw !== 'string') return 'Password is required';
  if (pw.length < 12) return 'Password must be at least 12 characters';
  if (!/\d/.test(pw)) return 'Password must include at least one number';
  return null;
}
