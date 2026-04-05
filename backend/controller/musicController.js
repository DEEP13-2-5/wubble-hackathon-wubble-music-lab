import {
  buildTrackResponse,
  pollGenerationStatus,
  submitGenerationRequest,
  uploadVoiceFileToWubble,
  waitForGenerationCompletion
} from "../services/wubbleService.js";

function parseArrayField(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [trimmed];
    } catch {
      return [trimmed];
    }
  }

  return [];
}

function parseBooleanField(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n", "off"].includes(normalized)) {
      return false;
    }
  }

  return undefined;
}

function buildGenerationOptions(payload, extraVoiceGsUris = []) {
  const instrumental = parseBooleanField(payload.instrumental);
  const vocals = parseBooleanField(payload.vocals);

  return {
    prompt: payload.prompt,
    emotion: payload.emotion,
    projectId: payload.projectId || payload.project_id,
    instrumental,
    vocals,
    voiceGsUris: [...parseArrayField(payload.voiceGsUris), ...parseArrayField(payload.audios), ...extraVoiceGsUris],
    images: parseArrayField(payload.images),
    videos: parseArrayField(payload.videos),
    documents: parseArrayField(payload.documents)
  };
}

function trackFromGenerationState(generationOptions, requestInfo, statusInfo) {
  return buildTrackResponse({
    prompt: generationOptions.prompt,
    emotion: generationOptions.emotion,
    instrumental: generationOptions.instrumental,
    vocals: generationOptions.vocals,
    requestId: requestInfo.requestId,
    projectId: requestInfo.projectId,
    status: statusInfo.status,
    title: statusInfo.title,
    lyrics: statusInfo.lyrics,
    audioUrl: statusInfo.audioUrls[0]
  });
}

export async function uploadVoiceHandler(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "file is required" });
  }

  try {
    const upload = await uploadVoiceFileToWubble(req.file);
    return res.status(200).json({
      uploadId: upload.uploadId,
      gsutilUri: upload.gsutilUri,
      mimeType: upload.mimeType,
      size: upload.size
    });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
}

export async function generateMusicAsyncHandler(req, res) {
  const { prompt } = req.body;
  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    const generationOptions = buildGenerationOptions(req.body);
    const requestInfo = await submitGenerationRequest(generationOptions);
    return res.status(202).json({
      requestId: requestInfo.requestId,
      projectId: requestInfo.projectId,
      status: "processing"
    });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
}

export async function getGenerationStatusHandler(req, res) {
  const { requestId } = req.params;
  if (!requestId) {
    return res.status(400).json({ error: "requestId is required" });
  }

  try {
    const statusInfo = await pollGenerationStatus(requestId);
    return res.status(200).json(statusInfo);
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
}

export async function generateMusicHandler(req, res) {
  const { prompt } = req.body;
  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    const generationOptions = buildGenerationOptions(req.body);
    const requestInfo = await submitGenerationRequest(generationOptions);
    const statusInfo = await waitForGenerationCompletion(requestInfo.requestId);

    if (!statusInfo.audioUrls.length) {
      return res.status(202).json({
        requestId: requestInfo.requestId,
        projectId: requestInfo.projectId,
        status: statusInfo.status,
        message: statusInfo.message || "Generation is still processing"
      });
    }

    const track = trackFromGenerationState(generationOptions, requestInfo, statusInfo);
    return res.status(200).json({ track });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
}

export async function generateWithVoiceHandler(req, res) {
  const { prompt } = req.body;
  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    const voiceUpload = req.file ? await uploadVoiceFileToWubble(req.file) : null;
    const generationOptions = buildGenerationOptions(req.body, voiceUpload ? [voiceUpload.gsutilUri] : []);

    const requestInfo = await submitGenerationRequest(generationOptions);
    const statusInfo = await waitForGenerationCompletion(requestInfo.requestId);

    if (!statusInfo.audioUrls.length) {
      return res.status(202).json({
        requestId: requestInfo.requestId,
        projectId: requestInfo.projectId,
        status: statusInfo.status,
        voiceGsutilUri: voiceUpload?.gsutilUri || null,
        message: statusInfo.message || "Generation is still processing"
      });
    }

    const track = trackFromGenerationState(generationOptions, requestInfo, statusInfo);
    return res.status(200).json({
      track,
      voiceGsutilUri: voiceUpload?.gsutilUri || null
    });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
}
