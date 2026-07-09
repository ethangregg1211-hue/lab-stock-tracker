// NOTE: API key must be set via a server-side proxy for production use.
// Never expose ANTHROPIC_API_KEY in client-side code on GitHub Pages.
// This file is a placeholder for API integration logic.

const API_BASE = '/api'; // Replace with your proxy server URL

async function identifyItemFromImage(base64Image) {
  const response = await fetch(`${API_BASE}/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

async function suggestItemDetails(name) {
  const response = await fetch(`${API_BASE}/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
