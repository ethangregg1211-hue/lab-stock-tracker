function getApiKey() {
  return localStorage.getItem('anthropic_api_key') || '';
}

const SHARED_RULES = `
Rules:
- Only return values you can actually read from the label. Do not invent or guess values not visible.
- Never append "?" to any value. Use the confidence field to communicate uncertainty, not punctuation.
- If a field is uncertain, return the value you found as-is with confidence "medium" or "low".`;

const PROMPTS = {
  antibody: `You are reading a lab reagent or antibody vial label. Extract these fields and return ONLY a valid JSON object, no other text:
catalog_number, lot_number, target, host_species, clone, concentration, expiry, storage.
For every field return an object: { "value": "<string or null>", "confidence": "high" | "medium" | "low" }
- "high"   = clearly legible text
- "medium" = partially readable, faded, or inferred from context
- "low"    = not found or completely unreadable
Example: { "catalog_number": { "value": "ab12345", "confidence": "high" }, "lot_number": { "value": null, "confidence": "low" }, ... }${SHARED_RULES}`,

  box: `You are reading a lab sample tube, cryovial, or storage box label. Extract these fields and return ONLY a valid JSON object, no other text:
sample_name, date, researcher, volume, description.
For every field return: { "value": "<string or null>", "confidence": "high" | "medium" | "low" }${SHARED_RULES}`,

  histology: `You are reading a histology slide label. Extract these fields and return ONLY a valid JSON object, no other text:
study, sample_mouse_id, tissue, stain, notes.
For every field return: { "value": "<string or null>", "confidence": "high" | "medium" | "low" }${SHARED_RULES}`,

  tissue: `You are reading a wax tissue block or cassette label. Extract these fields and return ONLY a valid JSON object, no other text:
study_id, sample_number, tissue_site, notes.
For every field return: { "value": "<string or null>", "confidence": "high" | "medium" | "low" }
Field format constraints:
- sample_number: must match the format # followed by 1 or 2 digits (examples: #1, #8, #23). If you cannot find a value matching this exact format on the label, return null with confidence "low". Do not guess.${SHARED_RULES}`,
};

const _offlineQueue = [];

async function readLabelWithClaude(base64Image, sessionType) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key configured - open Settings to add it.');

  if (!navigator.onLine) {
    _offlineQueue.push({ base64Image, sessionType, ts: Date.now() });
    throw new Error('You are offline. The scan has been queued and will retry when reconnected.');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
          { type: 'text', text: PROMPTS[sessionType] || PROMPTS.box },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  const text = (data.content?.[0]?.text || '').trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Unexpected response — no JSON found.');
  return JSON.parse(match[0]);
}
