/**
 * Sends a meal photo to the Google Gemini API and gets back a list of foods
 * with grams, kcal and macros as JSON.
 *
 * - Called directly from the phone; the key goes in the x-goog-api-key header.
 * - Structured output: generationConfig.responseFormat with a JSON schema
 *   (format confirmed against the live API in Nov 2026).
 * - If the main model is rate-limited (429), busy (5xx) or too slow, we retry
 *   once with the Flash-Lite fallback model.
 */

import { FALLBACK_MODEL } from './settings';
import type { Confidence, FoodItem } from './meal';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const ATTEMPT_TIMEOUT_MS = 40_000; // per model; then we try the fallback

const PROMPT =
  'You are a nutrition estimator. Identify every distinct food or drink in the photo. ' +
  'For each, estimate the edible portion in grams and its calories, protein, fat and carbohydrates ' +
  'for that portion, using typical values for European home cooking. Account for visible oils, ' +
  'sauces and dressings. If unsure, give your best estimate and lower the confidence. ' +
  'If the photo shows no food, return an empty list and say why in `note`.';

// The response schema from SPEC.md, in the JSON Schema form Gemini accepts.
const SCHEMA = {
  type: 'object',
  properties: {
    meal_name: { type: 'string', description: 'Short name for the whole meal' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          grams: { type: 'number' },
          kcal: { type: 'number' },
          protein_g: { type: 'number' },
          fat_g: { type: 'number' },
          carbs_g: { type: 'number' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['name', 'grams', 'kcal', 'protein_g', 'fat_g', 'carbs_g', 'confidence'],
      },
    },
    note: { type: 'string' },
  },
  required: ['meal_name', 'items', 'note'],
};

export type Analysis = { meal_name: string; items: FoodItem[]; note: string };

export type GeminiErrorKind = 'offline' | 'key' | 'limit' | 'busy' | 'timeout' | 'bad' | 'cancelled';

export class GeminiError extends Error {
  kind: GeminiErrorKind;
  constructor(kind: GeminiErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

const MESSAGES: Record<GeminiErrorKind, string> = {
  offline: 'No internet. Your photo is kept.',
  key: 'Gemini rejected the key. Check it in Settings.',
  limit: 'Free limit reached for now. Try again later.',
  busy: 'Gemini is busy right now. Try again in a minute.',
  timeout: 'Gemini took too long to answer. Try again.',
  bad: "Gemini couldn't read this photo. Retake it or add the food manually.",
  cancelled: 'Cancelled.',
};

const fail = (kind: GeminiErrorKind) => new GeminiError(kind, MESSAGES[kind]);

type Options = {
  key: string;
  model: string;
  imageBase64: string;
  note?: string;       // e.g. "half portion" from "Re-check with a note"
  signal?: AbortSignal; // Cancel button
};

/** Analyses one photo. Throws GeminiError with a one-line message on failure. */
export async function analyzePhoto(opts: Options): Promise<Analysis> {
  if (!opts.key) throw new GeminiError('key', 'Add your Gemini API key in Settings.');
  try {
    return await callModel(opts.model, opts);
  } catch (err) {
    const retry = err instanceof GeminiError && ['limit', 'busy', 'timeout'].includes(err.kind);
    if (!retry || opts.model === FALLBACK_MODEL) throw err;
    return await callModel(FALLBACK_MODEL, opts);
  }
}

async function callModel(model: string, opts: Options): Promise<Analysis> {
  const parts: object[] = [{ inlineData: { mimeType: 'image/jpeg', data: opts.imageBase64 } }];
  if (opts.note?.trim()) parts.push({ text: `Note about this meal: ${opts.note.trim()}` });

  const body = {
    systemInstruction: { parts: [{ text: PROMPT }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: SCHEMA } },
    },
  };

  // Stop after 40 s, or immediately when Cancel is pressed.
  const timeout = AbortSignal.timeout(ATTEMPT_TIMEOUT_MS);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.key },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    if (opts.signal?.aborted) throw fail('cancelled');
    if (timeout.aborted) throw fail('timeout');
    if (!navigator.onLine) throw fail('offline');
    throw fail('busy');
  }

  if (!response.ok) throw fail(kindForStatus(response.status, await response.text()));

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw fail('bad');
  }
  return parseAnalysis(data);
}

/** Maps an HTTP error from Gemini to one of our error kinds. */
function kindForStatus(status: number, text: string): GeminiErrorKind {
  if (status === 429) return 'limit';
  if (status === 401 || status === 403) return 'key';
  if (status === 400 && /api key/i.test(text)) return 'key';
  if (status === 404) return 'key'; // unknown model name – also fixed in Settings
  if (status >= 500) return 'busy';
  return 'bad';
}

/** Reads Gemini's answer and makes sure every value is usable. */
function parseAnalysis(data: any): Analysis {
  const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('');
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw fail('bad');
  }

  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0);
  const confidence = (v: unknown): Confidence => (v === 'high' || v === 'low' ? v : 'medium');

  const items: FoodItem[] = (Array.isArray(raw?.items) ? raw.items : [])
    .filter((i: any) => i && typeof i.name === 'string' && i.name.trim())
    .map((i: any) => ({
      name: i.name.trim(),
      grams: num(i.grams),
      kcal: num(i.kcal),
      protein_g: num(i.protein_g),
      fat_g: num(i.fat_g),
      carbs_g: num(i.carbs_g),
      confidence: confidence(i.confidence),
    }));

  return {
    meal_name: typeof raw?.meal_name === 'string' ? raw.meal_name.trim() : '',
    items,
    note: typeof raw?.note === 'string' ? raw.note.trim() : '',
  };
}

/** For "Test connection": checks the key and model name without using a photo. */
export async function checkGemini(key: string, model: string): Promise<void> {
  if (!key) throw new GeminiError('key', 'No Gemini API key entered.');
  let response: Response;
  try {
    response = await fetch(`${API}/${encodeURIComponent(model)}`, {
      headers: { 'x-goog-api-key': key },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw fail(navigator.onLine ? 'busy' : 'offline');
  }
  if (response.status === 404) throw new GeminiError('key', `Gemini doesn't know the model "${model}". Check it under Advanced.`);
  if (!response.ok) throw fail(kindForStatus(response.status, await response.text()));
}

export function geminiMessage(err: unknown): string {
  return err instanceof GeminiError ? err.message : 'Something went wrong. Try again.';
}
