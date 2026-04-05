import crypto from "crypto";

const EMOTION_PROMPT_PREFIX = {
  happy: "Create a joyful and uplifting track with bright energy.",
  sad: "Create an emotional and melancholic track with deep feeling.",
  romantic: "Create a warm and romantic track with soft expressive mood.",
  angry: "Create an intense and aggressive track with strong drive.",
  calm: "Create a peaceful and calm track with smooth flow.",
  epic: "Create a cinematic epic track with dramatic progression.",
  nostalgic: "Create a nostalgic track with old-memory vibes.",
  dreamy: "Create a dreamy ambient track with floating textures.",
  energetic: "Create a high-energy track with strong momentum."
};

function normalizeEndpoint(baseUrl, endpoint) {
  if (!endpoint) {
    return baseUrl;
  }

  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }

  return `${baseUrl}${endpoint}`;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function toHttpAudioUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return "";
  }

  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }

  if (rawUrl.startsWith("s3://")) {
    const path = rawUrl.slice("s3://".length);
    const firstSlash = path.indexOf("/");
    if (firstSlash > 0) {
      const bucket = path.slice(0, firstSlash);
      const key = path.slice(firstSlash + 1);
      return `https://${bucket}.s3.ap-southeast-1.amazonaws.com/${key}`;
    }
  }

  return rawUrl;
}

function searchForKey(obj, targetKey) {
  if (!obj || typeof obj !== 'object') return null;
  if (obj[targetKey]) return obj[targetKey];
  for (const key in obj) {
    const found = searchForKey(obj[key], targetKey);
    if (found) return found;
  }
  return null;
}

function collectValuesForKey(obj, targetKey, bucket = []) {
  if (!obj || typeof obj !== "object") {
    return bucket;
  }

  if (Object.prototype.hasOwnProperty.call(obj, targetKey) && obj[targetKey]) {
    bucket.push(obj[targetKey]);
  }

  for (const key in obj) {
    const value = obj[key];
    if (value && typeof value === "object") {
      collectValuesForKey(value, targetKey, bucket);
    }
  }

  return bucket;
}

function extractLyricsFromSegments(statusPayload) {
  const segments = statusPayload?.results?.custom_data?.segments || [];
  if (!segments.length) return null;

  const lines = [];
  const pushLine = (value) => {
    const text = String(value || "").trim();
    if (text) lines.push(text);
  };

  const readLineLike = (lineLike) => {
    if (typeof lineLike === "string") {
      pushLine(lineLike);
      return;
    }
    if (!lineLike || typeof lineLike !== "object") {
      return;
    }
    pushLine(lineLike.text || lineLike.lyrics || lineLike.content || lineLike.line);
  };

  segments.forEach((seg) => {
    if (typeof seg === "string") {
      pushLine(seg);
      return;
    }

    if (!seg || typeof seg !== "object") {
      return;
    }

    // Some payloads carry segment-level text directly.
    readLineLike(seg);

    if (Array.isArray(seg.lines)) {
      seg.lines.forEach(readLineLike);
    }

    if (Array.isArray(seg.lyrics)) {
      seg.lyrics.forEach(readLineLike);
    }
  });

  return lines.length ? lines.join("\n") : null;
}

function normalizeLyricsValue(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const text = value.trim();
    return text || null;
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          return String(item.text || item.lyrics || "").trim();
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
    return joined || null;
  }

  if (typeof value === "object") {
    if (Array.isArray(value.lines)) {
      return normalizeLyricsValue(value.lines);
    }
    if (Array.isArray(value.lyrics)) {
      return normalizeLyricsValue(value.lyrics);
    }
    if (Array.isArray(value.segments)) {
      return normalizeLyricsValue(value.segments);
    }

    const text = String(value.text || value.lyrics || value.content || "").trim();
    return text || null;
  }

  return null;
}

function pickBestLyricsCandidate(candidates) {
  const normalized = candidates
    .map((candidate) => normalizeLyricsValue(candidate))
    .filter(Boolean);

  if (!normalized.length) {
    return null;
  }

  normalized.sort((a, b) => {
    const aLines = a.split(/\r?\n/).length;
    const bLines = b.split(/\r?\n/).length;
    if (aLines !== bLines) return bLines - aLines;
    return b.length - a.length;
  });

  return normalized[0] || null;
}

function lyricScore(value) {
  if (!value || typeof value !== "string") return 0;
  const text = value.trim();
  if (!text) return 0;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.length * 1000 + text.length;
}

function collectAudioUrls(statusPayload) {
  const rawUrls = [
    statusPayload?.streaming?.final_audio_url,
    statusPayload?.streaming?.stream_url,
    statusPayload?.audio_url,
    statusPayload?.streaming_url,
    statusPayload?.audioUrl,
    ...(statusPayload?.results?.custom_data?.audios || []).flatMap((audio) => [audio?.audio_url, audio?.stream_url])
  ].filter(Boolean);

  const unique = [...new Set(rawUrls.map(toHttpAudioUrl).filter(Boolean))];
  return unique;
}

function buildPrompt(prompt, emotion, instrumental = false) {
  const normalizedPrompt = String(prompt || "").trim();
  if (!normalizedPrompt) {
    return "";
  }

  let finalPrompt = normalizedPrompt;
  const key = String(emotion || "").toLowerCase().trim();
  if (key && EMOTION_PROMPT_PREFIX[key]) {
    finalPrompt = `${EMOTION_PROMPT_PREFIX[key]} User request: ${normalizedPrompt}`;
  }

  if (instrumental) {
    return `[Instrumental] No vocals. [Style: PURE INSTRUMENTAL ONLY]. No singing. No voice. No chant. Only instruments. ${finalPrompt} [Instrumental]`;
  }

  return finalPrompt;
}

function getWubbleConfig() {
  const baseUrl = process.env.WUBBLE_API_BASE_URL;
  const apiKey = process.env.WUBBLE_API_KEY;
  const chatEndpoint = process.env.WUBBLE_GENERATE_ENDPOINT || "/api/v1/chat";
  const pollEndpointTemplate = process.env.WUBBLE_POLL_ENDPOINT || "/api/v1/polling/{requestId}";
  const uploadEndpoint = process.env.WUBBLE_UPLOAD_ENDPOINT || "/api/v1/upload";

  return {
    baseUrl,
    apiKey,
    chatUrl: normalizeEndpoint(baseUrl, chatEndpoint),
    uploadUrl: normalizeEndpoint(baseUrl, uploadEndpoint),
    pollEndpointTemplate,
    pollLimit: Number(process.env.WUBBLE_POLL_LIMIT || 20),
    pollDelayMs: Number(process.env.WUBBLE_POLL_DELAY_MS || 3000)
  };
}

function buildPollUrlCandidates(config, { requestId, projectId } = {}) {
  const safeRequestId = encodeURIComponent(String(requestId || ""));
  const safeProjectId = encodeURIComponent(String(projectId || ""));
  const template = String(config.pollEndpointTemplate || "/api/v1/polling/{requestId}").trim();
  const normalizedTemplate = template.includes("{requestId}") ? template : "/api/v1/polling/{requestId}";

  const candidates = [];
  const pushCandidate = (endpoint) => {
    const url = normalizeEndpoint(config.baseUrl, endpoint);
    if (url && !candidates.includes(url)) {
      candidates.push(url);
    }
  };

  if (safeRequestId) {
    pushCandidate(normalizedTemplate.replace("{requestId}", safeRequestId));
    pushCandidate(`/api/v1/polling?requestId=${safeRequestId}`);
    pushCandidate(`/api/v1/polling/${safeRequestId}/status`);
  }

  if (safeProjectId) {
    pushCandidate(normalizedTemplate.replace("{requestId}", safeProjectId));
    pushCandidate(`/api/v1/polling?projectId=${safeProjectId}`);
    pushCandidate(`/api/v1/polling/${safeProjectId}/status`);
  }

  return candidates;
}

function assertWubbleConfig(config) {
  if (!config.baseUrl || !config.apiKey) {
    throw new Error("Missing WUBBLE_API_BASE_URL or WUBBLE_API_KEY");
  }
}

export async function submitGenerationRequest({
  prompt,
  emotion,
  projectId,
  instrumental,
  vocals,
  voiceGsUris = [],
  images = [],
  videos = [],
  documents = []
}) {
  const config = getWubbleConfig();
  assertWubbleConfig(config);

  const resolvedInstrumental = typeof instrumental === "boolean" ? instrumental : false;
  const resolvedVocals = typeof vocals === "boolean" ? vocals : !resolvedInstrumental;
  const allowVoiceReference = !resolvedInstrumental;

  const payload = {
    prompt: buildPrompt(prompt, emotion, resolvedInstrumental),
    // Fortify flags to ensure instrumental tracks do not produce vocals/lyrics.
    vo: resolvedVocals,
    vocals: resolvedVocals,
    instrumental: resolvedInstrumental,
    instrumental_only: resolvedInstrumental,
    is_instrumental: resolvedInstrumental,
    make_instrumental: resolvedInstrumental,
    no_vocals: resolvedInstrumental,
    has_vocals: resolvedVocals,
    generate_lyrics: resolvedVocals,
    lyrics: resolvedVocals ? undefined : ""
  };

  if (projectId) {
    payload.project_id = projectId;
  }

  const audios = allowVoiceReference ? normalizeStringArray(voiceGsUris) : [];
  if (audios.length > 0) {
    payload.audios = audios;
  }

  const imageUris = normalizeStringArray(images);
  if (imageUris.length > 0) {
    payload.images = imageUris;
  }

  const videoUris = normalizeStringArray(videos);
  if (videoUris.length > 0) {
    payload.videos = videoUris;
  }

  const documentUris = normalizeStringArray(documents);
  if (documentUris.length > 0) {
    payload.documents = documentUris;
  }

  let response;
  try {
    response = await fetch(config.chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    throw new Error(`Wubble generate fetch failed: ${error.cause?.code || error.cause?.message || error.message}`);
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Wubble generate failed: ${response.status} ${message}`);
  }

  const generated = await response.json();
  const requestId = generated.request_id || generated.requestId || generated.id;
  if (!requestId) {
    throw new Error("Wubble generate response did not include request_id");
  }

  return {
    requestId,
    projectId: generated.project_id || generated.projectId || projectId || null,
    raw: generated
  };
}

export async function pollGenerationStatus(requestId) {
  const config = getWubbleConfig();
  assertWubbleConfig(config);

  const pollUrls = buildPollUrlCandidates(config, { requestId });
  let response = null;
  let lastError = null;

  for (const pollUrl of pollUrls) {
    try {
      response = await fetch(pollUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.apiKey}`
        }
      });
    } catch (error) {
      lastError = error;
      continue;
    }

    if (response.ok) {
      break;
    }

    const message = await response.text();
    if (response.status !== 404) {
      throw new Error(`Wubble status failed: ${response.status} ${message}`);
    }

    lastError = new Error(`Wubble status failed: ${response.status} ${message}`);
  }

  if (!response || !response.ok) {
    throw new Error(lastError?.message || "Wubble poll fetch failed");
  }

  const statusPayload = await response.json();
  console.log("RAW WUBBLE RESPONSE:", JSON.stringify(statusPayload, null, 2));
  const audioUrls = collectAudioUrls(statusPayload);

  // Try specialized segment extraction first for better multi-line results
  const segmentLyrics = extractLyricsFromSegments(statusPayload);

  // Deep search for lyrics in the entire payload as a backup.
  const lyricsCandidates = [
    statusPayload?.results?.custom_data?.lyrics,
    ...collectValuesForKey(statusPayload, "lyrics"),
    ...collectValuesForKey(statusPayload, "text")
  ];

  const lyrics = segmentLyrics || pickBestLyricsCandidate(lyricsCandidates) || null;

  return {
    requestId,
    status: statusPayload.status || "processing",
    title: statusPayload.song_title || null,
    message: statusPayload.message || statusPayload.model_response || null,
    lyrics: lyrics,
    audioUrls,
    raw: statusPayload
  };
}

export async function waitForGenerationCompletion(requestId) {
  const config = getWubbleConfig();
  assertWubbleConfig(config);
  const audioGracePolls = 4;

  let lastStatus = null;
  let bestStatusWithAudio = null;
  let bestLyricScore = 0;
  let firstAudioPoll = -1;
  for (let i = 0; i < config.pollLimit; i += 1) {
    const current = await pollGenerationStatus(requestId);
    lastStatus = current;
    const normalizedStatus = String(current.status || "").toLowerCase();
    const isCompleted = ["completed", "complete", "done", "success", "succeeded", "finished"].includes(normalizedStatus);
    const isFailed = ["failed", "error"].includes(normalizedStatus);
    const hasAudio = Array.isArray(current.audioUrls) && current.audioUrls.length > 0;
    const currentLyricScore = lyricScore(current.lyrics);

    if (hasAudio && firstAudioPoll < 0) {
      firstAudioPoll = i;
    }

    if (hasAudio && (!bestStatusWithAudio || currentLyricScore > bestLyricScore)) {
      bestStatusWithAudio = current;
      bestLyricScore = currentLyricScore;
    }

    if (isFailed) {
      throw new Error(current.message || "Wubble generation failed");
    }

    if (isCompleted && hasAudio) {
      if (bestLyricScore > 0) {
        return {
          completed: true,
          ...(bestStatusWithAudio || current)
        };
      }
      if (firstAudioPoll >= 0 && i - firstAudioPoll >= 1) {
        return {
          completed: true,
          ...(bestStatusWithAudio || current)
        };
      }
    }

    if (hasAudio && firstAudioPoll >= 0 && i - firstAudioPoll >= audioGracePolls) {
      return {
        completed: true,
        ...(bestStatusWithAudio || current)
      };
    }

    await new Promise((resolve) => setTimeout(resolve, config.pollDelayMs));
  }

  if (bestStatusWithAudio) {
    return {
      completed: true,
      ...bestStatusWithAudio
    };
  }

  return {
    completed: false,
    ...(lastStatus || { requestId, status: "processing", audioUrls: [], raw: {} })
  };
}

export async function uploadVoiceFileToWubble(file) {
  const config = getWubbleConfig();
  assertWubbleConfig(config);

  if (!file?.buffer || !file?.mimetype || !file?.originalname) {
    throw new Error("Invalid upload file payload");
  }

  const formData = new FormData();
  const blob = new Blob([file.buffer], { type: file.mimetype });
  formData.append("file", blob, file.originalname);

  let response;
  try {
    response = await fetch(config.uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`
      },
      body: formData
    });
  } catch (error) {
    throw new Error(`Wubble upload fetch failed: ${error.cause?.code || error.cause?.message || error.message}`);
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Wubble upload failed: ${response.status} ${message}`);
  }

  const payload = await response.json();
  const gsutilUri = payload.gsutilUri || payload.gsutil_uri || payload.uri || payload.file?.gsutilUri;
  if (!gsutilUri) {
    throw new Error(`Wubble upload did not return gsutilUri: ${JSON.stringify(payload)}`);
  }

  return {
    uploadId: payload.id || crypto.randomUUID(),
    gsutilUri,
    mimeType: file.mimetype,
    size: file.size,
    raw: payload
  };
}

export function buildTrackResponse({ prompt, emotion, instrumental, vocals, requestId, projectId, status, title, audioUrl, lyrics }) {
  return {
    id: requestId,
    requestId,
    projectId: projectId || null,
    title: title || `Generated: ${String(prompt || "").slice(0, 24) || "Untitled"}`,
    prompt,
    emotion: emotion || null,
    instrumental: typeof instrumental === "boolean" ? instrumental : null,
    vocals: typeof vocals === "boolean" ? vocals : null,
    audioUrl,
    lyrics: lyrics || null,
    createdAt: new Date().toISOString(),
    animationStyle: ["nebula", "wave", "storm", "spiral"][Math.floor(Math.random() * 4)],
    animationSeed: Math.floor(Math.random() * 100000),
    generationStatus: status || "completed"
  };
}
