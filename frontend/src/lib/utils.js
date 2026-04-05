/** Format mm:ss from seconds */
export function fmtTime(secs) {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** Get initials from a name */
export function initials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

/** Format relative time */
export function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Sanitize user-generated text (prevent XSS) */
export function sanitize(str = '') {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/** Validate file for voice upload */
export function validateAudioFile(file) {
  if (!file) return null;
  const allowed = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/webm'];
  if (!allowed.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|ogg|webm)$/i)) {
    return 'File must be an audio file (MP3, WAV, M4A, OGG)';
  }
  if (file.size > 25 * 1024 * 1024) {
    return 'File must be under 25MB';
  }
  return null;
}

/** Copy text to clipboard */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Build share URL for a track */
export function buildShareUrl(trackId) {
  return `${window.location.origin}/#track-${trackId}`;
}

/** Clamp a value */
export const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/** Socket URL */
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';
