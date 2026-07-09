function getApiKey() {
  return localStorage.getItem('anthropic_api_key') || '';
}

const PROMPTS = {
  antibody: `You are reading a lab reagent or antibody vial label. Extract these fields and return ONLY a valid JSON object, no other text:
catalog_number, lot_number, target, host_species, clone, concentration, expiry, storage.
For every field return an object: { "value": "<string or null>", "confidence": "high" | "medium" | "low" }
- "high"   = clearly legible text
- "medium" = partially readable, faded, or inferred from context
- "low"    = not found or completely unreadable
Example: { "catalog_number": { "value": "ab12345", "confidence": "high" }, "lot_number": { "value": null, "confidence": "low" }, ... }`,

  box: `You are reading a lab sample tube, cryovial, or storage box label. Extract these fields and return ONLY a valid JSON object, no other text:
sample_name, date, researcher, volume, description.
For every field return: { "value": "<string or null>", "confidence": "high" | "medium" | "low" }`,

  histology: `You are reading a histology slide or cassette label. Extract these fields and return ONLY a valid JSON object, no other text:
accession_number, slide_number, stain, tissue, diagnosis, date, researcher, block_id.
For every field return: { "value": "<string or null>", "confidence": "high" | "medium" | "low" }`,
};

const _offlineQueue = [];

async function readLabelWithClaude(base64Image, sessionType) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key configured — tap ⚙ to add it.');

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
