const BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Core fetch wrapper — attaches auth header, parses JSON, throws on error.
 */
export async function apiFetch(endpoint, { method = 'GET', body, token, isFormData = false } = {}) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${endpoint}`, {
    method,
    headers,
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error('Invalid server response. Check backend is running and API URL is correct.');
  }

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

// ── Auth ───────────────────────────────────────────────────────────────────
export const authApi = {
  signup: ({ name, email, password }) =>
    apiFetch('/auth/signup', { method: 'POST', body: { name, email, password } }),

  login: ({ email, password }) =>
    apiFetch('/auth/login', { method: 'POST', body: { email, password } }),

  me: (token) =>
    apiFetch('/auth/me', { token }),
};

// ── Music ──────────────────────────────────────────────────────────────────
export const musicApi = {
  generate: ({ prompt, emotion, instrumental, vocals, token }) =>
    apiFetch('/music/generate', { method: 'POST', body: { prompt, emotion, instrumental, vocals }, token }),

  generateAsync: ({ prompt, emotion, instrumental, vocals, token }) =>
    apiFetch('/music/generate-async', { method: 'POST', body: { prompt, emotion, instrumental, vocals }, token }),

  getStatus: ({ requestId, token }) =>
    apiFetch(`/music/requests/${requestId}`, { token }),

  generateWithVoice: ({ formData, token }) =>
    apiFetch('/music/generate-with-voice', { method: 'POST', body: formData, token, isFormData: true }),

  uploadVoice: ({ formData, token }) =>
    apiFetch('/music/upload-voice', { method: 'POST', body: formData, token, isFormData: true }),
};

// ── Public ─────────────────────────────────────────────────────────────────
export const publicApi = {
  list: () => apiFetch('/public/tracks'),

  publish: ({ track, sourceKind, sourceId, sourceLabel, publisherName, publisherType, token }) =>
    apiFetch('/public/tracks', {
      method: 'POST',
      body: { track, sourceKind, sourceId, sourceLabel, publisherName, publisherType },
      token,
    }),

  vote: ({ trackId, voteType, token }) =>
    apiFetch(`/public/tracks/${trackId}/vote`, { method: 'POST', body: { voteType }, token }),

  comment: ({ trackId, text, token }) =>
    apiFetch(`/public/tracks/${trackId}/comment`, { method: 'POST', body: { text }, token }),

  delete: ({ trackId, token }) =>
    apiFetch(`/public/tracks/${trackId}`, { method: 'DELETE', token }),
};

// ── Teams ──────────────────────────────────────────────────────────────────
export const teamApi = {
  mine: (token) => apiFetch('/teams/mine', { token }),

  create: ({ name, token }) =>
    apiFetch('/teams/create', { method: 'POST', body: { name }, token }),

  join: ({ inviteCode, token }) =>
    apiFetch('/teams/join', { method: 'POST', body: { inviteCode }, token }),

  get: ({ teamId, token }) => apiFetch(`/teams/${teamId}`, { token }),

  createVersion: ({ teamId, name, track, token }) =>
    apiFetch(`/teams/${teamId}/versions`, { method: 'POST', body: { name, track }, token }),

  vote: ({ teamId, versionId, token }) =>
    apiFetch(`/teams/${teamId}/versions/${versionId}/vote`, { method: 'POST', token }),

  publish: ({ teamId, versionId, token }) =>
    apiFetch(`/teams/${teamId}/versions/${versionId}/publish`, { method: 'POST', token }),
};

function lyricScore(value) {
  if (!value || typeof value !== 'string') return 0;
  const text = value.trim();
  if (!text) return 0;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.length * 1000 + text.length;
}

// ── Polling helper ─────────────────────────────────────────────────────────
export async function pollStatus({ requestId, token, onTick, maxAttempts = 30, interval = 3000 }) {
  const completedStatuses = new Set(['done', 'completed', 'complete', 'success', 'succeeded', 'finished']);
  const failedStatuses = new Set(['failed', 'error']);
  const audioGraceAttempts = 4;
  let bestData = null;
  let bestScore = 0;
  let firstAudioAttempt = -1;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, interval));
    const data = await musicApi.getStatus({ requestId, token });
    if (onTick) onTick(data);
    const status = String(data.status || '').toLowerCase();
    const hasAudio = Array.isArray(data.audioUrls) && data.audioUrls.length > 0;
    const currentScore = lyricScore(data.lyrics);

    if (hasAudio && firstAudioAttempt < 0) {
      firstAudioAttempt = i;
    }

    if (hasAudio && (!bestData || currentScore > bestScore)) {
      bestData = data;
      bestScore = currentScore;
    }

    if (failedStatuses.has(status)) throw new Error(data.message || 'Generation failed');

    if (completedStatuses.has(status) && hasAudio) {
      if (bestScore > 0) return bestData || data;
      if (firstAudioAttempt >= 0 && i - firstAudioAttempt >= 1) return bestData || data;
      continue;
    }

    if (hasAudio && firstAudioAttempt >= 0 && i - firstAudioAttempt >= audioGraceAttempts) {
      return bestData || data;
    }
  }

  if (bestData) {
    return bestData;
  }

  throw new Error('Generation timed out. Please try again.');
}
