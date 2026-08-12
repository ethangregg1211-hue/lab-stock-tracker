function getApiKey() {
  return (window.LABSCAN_CONFIG && window.LABSCAN_CONFIG.apiKey)
    || localStorage.getItem('anthropic_api_key')
    || '';
}

const SHARED_RULES = `
Rules:
- Only return values you can actually read from the label. Do not invent or guess.
- Never append ? to any field value. Use the confidence field to communicate uncertainty, not punctuation.
- If a field is uncertain, return the value you found as-is with confidence "medium" or "low".`;

const TISSUE_PRESET_RULE = `
- For the tissue field, match what you read to the closest option from this list: tumor, mammary gland, cancer, GU, MG, RMG, LMG, bone, bones, tibia, femur, leg, legs, muscle, uterus, kidney, spleen, liver, lung, intestine, lymph node, brain, skin, ovary. If confident match return high confidence. If close but uncertain return medium confidence. If no match return what you read as low confidence.`;

const MOUSE_ID_RULE = `
- For the mouse_id field, it must match one of two formats: (1) a simple number from 1 to 99, or (2) the format C[1-20].P[1-50].M[value] where M is followed by 0-5, R, L, RL, 2L, or 2R. If what you read does not match either format, return the value as-is with low confidence.`;

const COMPANY_LIST_RULE = `
- For the company field, match what you read to the closest option from this list: BD Biosciences, eBioscience, Tonbo Biosciences, RD Systems, Invitrogen, Sino Biologicals, AbD Serotec, MBL, Santa Cruz, Novus, Cell Signaling, Abcam, Transduction Labs, Sigma, BioLegend, Chemicon, Molecular Probes, Millipore, Covance, LSBio, Upstate, Jackson Labs, Rockland, Epitomics, Proteintech. If confident match return high confidence. If no match return what you read as low confidence.`;

const PROMPTS = {
  antibody: `You are reading a lab reagent or antibody vial label. Extract these fields and return ONLY a valid JSON object, no other text:
catalog_number, lot_number, target, host_species, clone, concentration, expiry, storage.
For every field return an object: { "value": "<string or null>", "confidence": "high" | "medium" | "low" }
- "high"   = clearly legible text
- "medium" = partially readable, faded, or inferred from context
- "low"    = not found or completely unreadable${SHARED_RULES}${COMPANY_LIST_RULE}`,

  histology: `You are reading a histology label. Extract the specified fields and return ONLY a valid JSON object, no other text.
For every field return: { "value": "<string or null>", "confidence": "high" | "medium" | "low" }${SHARED_RULES}${TISSUE_PRESET_RULE}${MOUSE_ID_RULE}`,

  chemical: `You are reading a chemical reagent bottle label in a research lab. Extract the following fields and return ONLY a valid JSON object, no other text.

For every field return: { "value": "<string or null>", "confidence": "high" | "medium" | "low" }
- "high" = clearly read from printed text
- "medium" = partially obscured or not fully certain
- "low" = guessing or not found

Fields to extract:

chemical_description: The largest printed text on the label, usually in the center. This is the full chemical name (examples: Sodium pyruvate, Carbenicillin disodium salt, N-Ethylmaleimide, Collagenase Type 3, Tamoxifen). Ignore any handwritten text — only read printed text.

catalog_number: Usually in the top left corner. Often includes a size suffix (examples: P2256-5G, C1389-1G, E3876-5G, LS004182). Strip the size suffix before returning — P2256-5G becomes P2256, C1389-1G becomes C1389. For Worthington Biochem labels it will be explicitly labeled CAT #. For Sigma and Sigma-Aldrich labels it appears in the top left without a label.

lot_number: Usually in the top right corner, explicitly labeled Lot # or LOT #. Examples: SLBV6133, 123M4817V, 44B14762, WXBC0652VP. Return the full lot number as printed.

vendor: The company name or logo printed on the label. Common vendors: Sigma, Sigma-Aldrich, Worthington Biochem, Fisher, Aldrich, Millipore. Sigma-Aldrich labels have a red and white banner at the top. Worthington Biochem labels say Worthington-Biochem.com at the top. Return the vendor name as it appears on the label.

physical_state: Usually not printed on the label. Return "Solid" as the default unless the label explicitly says Liquid or Solution.

cas_num: If present, labeled CAS # or CAS-No on the label. Not always visible. Return null if not found — do not guess.

IMPORTANT: Ignore all handwritten text on the label. Lab members write opened dates, lab names, initials, and received dates directly on the bottle (examples: opened 6/12/26 AK, Welm 1.23.17, KAT, 2/23/15CID). These are annotations added after purchase — do not return them as field values. Never append ? to any field value. Never return handwritten text as a field value.`,
};

const _offlineQueue = [];

async function readLabelWithClaude(base64Image, sessionType, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key configured - open Settings to add it.');

  if (!navigator.onLine) {
    _offlineQueue.push({ base64Image, sessionType, ts: Date.now() });
    throw new Error('You are offline. The scan has been queued and will retry when reconnected.');
  }

  let prompt;

  if (sessionType === 'histology') {
    const template = options.template;
    const mode = options.mode || 'slides';
    const modeLabel = mode === 'slides' ? 'histology slide' : 'tissue block';

    if (template) {
      const allKeys = template.rows.flatMap(r => r.fields);
      const rowLines = template.rows
        .filter(r => r.fields.length > 0)
        .map(r => {
          const width = r.fields.length === 1 ? 'full width' : r.fields.length === 2 ? 'two halves (left | right)' : 'three thirds';
          const labels = r.fields.map(k => {
            const f = (typeof TEMPLATE_FIELDS !== 'undefined' ? TEMPLATE_FIELDS : []).find(x => x.key === k);
            return f ? f.label : k;
          });
          return `  ${r.name} (${width}): ${labels.join(' | ')}`;
        });

      prompt = `You are reading a ${modeLabel} label. Extract these fields and return ONLY a valid JSON object, no other text:
${allKeys.join(', ')}.
For every field return: { "value": "<string or null>", "confidence": "high" | "medium" | "low" }

Label layout — look in these positions:
${rowLines.join('\n')}${SHARED_RULES}${TISSUE_PRESET_RULE}${MOUSE_ID_RULE}`;
    } else {
      prompt = `You are reading a ${modeLabel} label. Extract these fields and return ONLY a valid JSON object, no other text:
mouse_id, tissue, stain, slide_no, initials, date, treatment, group, accession_no, experiment_id.
For every field return: { "value": "<string or null>", "confidence": "high" | "medium" | "low" }${SHARED_RULES}${TISSUE_PRESET_RULE}${MOUSE_ID_RULE}`;
    }

    if (options.studyName) {
      prompt += `\nSTUDY ID: The study ID for this session is "${options.studyName}". Do not try to read the study ID from the label. Use this exact value with confidence "high". If you see text on the label that appears to be a different study ID (meaningfully different from "${options.studyName}", not just capitalization or spacing), also set "study_mismatch": true and "study_id_found": "<what you read>".`;
    }
  } else {
    prompt = PROMPTS[sessionType] || PROMPTS.antibody;
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
