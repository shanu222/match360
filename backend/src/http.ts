import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export const bad = (msg: string, code?: string, extra?: Record<string, unknown>) => new HttpError(400, msg, code, extra);
export const notFound = (msg = 'Not found') => new HttpError(404, msg, 'not_found');
export const forbidden = (msg = 'Not allowed') => new HttpError(403, msg, 'forbidden');
export const conflict = (msg: string, code?: string, extra?: Record<string, unknown>) => new HttpError(409, msg, code, extra);

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    const field = first?.path?.join('.') || 'input';
    throw bad(`${field}: ${first?.message || 'invalid'}`, 'validation');
  }
  return r.data;
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code, ...(err.extra || {}) });
  }
  if (err instanceof ZodError) return res.status(400).json({ error: 'Invalid input', code: 'validation' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON', code: 'validation' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large', code: 'too_large' });
  console.error('[error]', err);
  res.status(500).json({ error: 'Something went wrong. Please try again.', code: 'server_error' });
}
