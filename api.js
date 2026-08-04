function getApiKey() {
  return localStorage.getItem('anthropic_api_key') || '';
}

const SHARED_RULES = `
Rules:
- Only return values you can actually read from the label. Do not invent or guess values not visible.
- Never append "?" to any value. Use the confidence field to communicate uncertainty, not punctuation.
- If a field is uncertain, return the value you found as-is with confidence "medium" or "low".`;

const TISSUE_PRESET_RULE = `
- tissue/site field: Compare what you read on the label to this preset list and return the closest matching option: tumor, mammary gland, cancer, GU, MG, RMG, LMG, bone, bones, tibia, femur, leg, legs, muscle, uterus, kidney, spleen, liver, lung, intestine, lymph node, brain, skin, ovary. If the match is confident return it as high confidence. If the match is close but not certain return it as medium confidence. If what you read does not match anything on the list, return what you actually read from the label as low confidence so the user can review it. Never reject a tissue/site value just because it is not on the list.`;

const PROMPTS = {
  antibody: `You are reading a lab reagent or antibody vial label. Extract these fields and return ONLY a valid JSON object, no other text:
catalog_number, lot_number, target, host_species, clone, concentration, expiry, storage.
For every field return an object: { "value": "<string or null>", "confidence": "high" | "medium" | "low" }
- "high"   = clearly legible text
- "medium" = partially readable, faded, or inferred from context
- "low"    = not found or completely unreadable
Example: { "catalog_number": { "value": "ab12345", "confidence": "high" }, "lot_number": { "value": null, "confidence": "low" }, ... }${SHARED_RULES}`,

  histology: `You are reading a histology slide label. Extract these fields and return ONLY a valid JSON object, no other text:
study, sample_mouse_id, tissue, stain, notes.
For every field return: { "value": "<string or null>", "confidence": "high" | "medium" | "low" }${SHARED_RULES}${TISSUE_PRESET_RULE}`,

  tissue: `You are reading a wax tissue block or cassette label. Extract these fields and return ONLY a valid JSON object, no other text:
study_id, sample_number, tissue_site, notes.
For every field return: { "value": "<string or null>", "confidence": "high" | "medium" | "low" }
Field format constraints:
- sample_number: must match the format # followed by 1 or 2 digits (examples: #1, #8, #23). If you cannot find a value matching this exact format on the label, return null with confidence "low". Do not guess.${SHARED_RULES}${TISSUE_PRESET_RULE}`,

  chemical: `You are reading a chemical container label (bottle, drum, jug, or similar). Extract these fields and return ONLY a valid JSON object, no other text:
chemical_description, cas_num, catalog_number, vendor, physical_state, lot_number, concentration.
For every field return an object: { "value": "<string or null>", "confidence": "high" | "medium" | "low" }
- "high"   = clearly legible text
- "medium" = partially readable, faded, or inferred from context
- "low"    = not found or completely unreadable
Example: { "chemical_description": { "value": "Ethanol", "confidence": "high" }, "cas_num": { "value": "64-17-5", "confidence": "high" }, ... }${SHARED_RULES}`,
};

const _offlineQueue = [];

async function readLabelWithClaude(base64Image, sessionType, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key configured - open Settings to add it.');

  if (!navigator.onLine) {
    _offlineQueue.push({ base64Image, sessionType, ts: Date.now() });
    throw new Error('You are offline. The scan has been queued and will retry when reconnected.');
  }

  let prompt = PROMPTS[sessionType] || PROMPTS.antibody;
  if (options.studyName) {
    const studyKey = sessionType === 'histology' ? 'study' : 'study_id';
    prompt += `\nSESSION CONTEXT: The study name for this session is "${options.studyName}". Read the label and look for a study ID. If you find one that is meaningfully different from "${options.studyName}" (more than minor capitalization or spacing differences), add "study_mismatch": true and "study_id_found": "<what you read>" to your JSON response. Either way, set ${studyKey} to "${options.studyName}" with confidence "high".`;
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
          { type: 'text', text: prompt },
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
