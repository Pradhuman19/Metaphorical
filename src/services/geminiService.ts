import { GoogleGenerativeAI } from "@google/generative-ai";

export interface CrossCheckReport {
  conflictLevel: 'Low' | 'Medium' | 'High';
  omissions: string[];
  framing: string;
  sourcePerspectives: Record<string, string>;
}

const MAX_PRIMARY_CHARS = 800;
const MAX_SOURCE_CHARS  = 400;
const MAX_SOURCES       = 3;

function trim(text: string, maxChars: number): string {
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '…';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateCrossCheckReport(
  apiKey: string,
  originalArticle: { title: string; body: string },
  secondarySources: { url: string; title: string; content: string }[]
): Promise<CrossCheckReport> {
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Go to Settings to add your key.');
  }

  console.log(`[Gemini] Using key prefix: ${apiKey.slice(0, 8)}…`);

  const genAI = new GoogleGenerativeAI(apiKey);
  const MODEL_NAME = 'gemini-2.5-flash';
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { responseMimeType: 'application/json' },
  });

  const primaryBody = trim(originalArticle.body, MAX_PRIMARY_CHARS);
  const sourcesText = secondarySources
    .slice(0, MAX_SOURCES)
    .map((s, i) => [
      `[S${i + 1}] ${new URL(s.url).hostname.replace('www.', '')}`,
      `Title: ${s.title}`,
      `Snippet: ${trim(s.content, MAX_SOURCE_CHARS)}`,
    ].join('\n'))
    .join('\n\n');

  const prompt =
`You are a neutral news analyst. Compare a PRIMARY article to ALTERNATIVE sources.

PRIMARY:
Title: ${originalArticle.title}
Body: ${primaryBody}

ALTERNATIVES:
${sourcesText}

Output ONLY valid JSON matching this exact schema — no markdown, no extra keys:
{"conflictLevel":"Low|Medium|High","omissions":["…"],"framing":"…","sourcePerspectives":{"S1":"…","S2":"…"}}`;

  console.log(`[Gemini] Prompt: ${prompt.length} chars (~${Math.round(prompt.length / 4)} tokens)`);

  const MAX_RETRIES = 2;
  const BACKOFF_MS  = [0, 65000];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 1) {
      console.log(`[Gemini] Waiting ${BACKOFF_MS[attempt - 1] / 1000}s before retry…`);
      await sleep(BACKOFF_MS[attempt - 1]);
    }

    try {
      console.log(`[Gemini] Attempt ${attempt}/${MAX_RETRIES} — model: ${MODEL_NAME}`);
      const result   = await model.generateContent(prompt);
      const response = await result.response;
      const rawText  = response.text().trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');

      const parsed = JSON.parse(rawText) as CrossCheckReport;
      console.log('[Gemini] Report generated ✓');
      return parsed;

    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      console.error(`[Gemini] Raw error (attempt ${attempt}):`, raw);

      const isQuota    = raw.includes('429') || raw.toLowerCase().includes('quota') || raw.toLowerCase().includes('resource_exhausted');
      const isNotFound = raw.includes('404') || raw.toLowerCase().includes('not found');
      const isAuth     = raw.includes('400') || raw.includes('401') || raw.includes('403') || raw.toLowerCase().includes('api key');

      if (isQuota && attempt < MAX_RETRIES) {
        console.warn('[Gemini] Rate limited — will retry after backoff…');
        continue;
      }

      let message: string;
      if (isQuota)    message = `Rate limit exceeded. Please wait ~1 minute and try again. (${raw.slice(0, 100)})`;
      else if (isNotFound) message = `Model '${MODEL_NAME}' not found for your API key. Verify your key has Gemini API enabled.`;
      else if (isAuth)     message = `API key rejected. Verify your Gemini key in Settings. (${raw.slice(0, 100)})`;
      else if (raw.toLowerCase().includes('failed to fetch')) message = 'Network error — check your internet connection.';
      else if (raw.toLowerCase().includes('syntaxerror'))     message = `Unexpected response format. Try again. (${raw.slice(0, 100)})`;
      else message = `Gemini error: ${raw.slice(0, 200)}`;

      throw new Error(message);
    }
  }

  throw new Error('Analysis failed after all retries.');
}
