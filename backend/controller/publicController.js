import {
  addPublicComment,
  createOrUpdatePublicTrack,
  listPublicTracks,
  votePublicTrack,
  deletePublicTrack
} from "../model/store.js";
import { getLandingContent } from "../model/landingContent.js";

export async function listPublicTracksHandler(_req, res) {
  try {
    return res.status(200).json({ tracks: await listPublicTracks() });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export async function publishPublicTrackHandler(req, res) {
  try {
    const { track, sourceKind, sourceId, sourceLabel, publisherName, publisherType } = req.body;
    if (!track || !sourceKind || !sourceId) {
      return res.status(400).json({ error: "track, sourceKind and sourceId are required" });
    }

    const publicTrack = await createOrUpdatePublicTrack({
      track,
      createdBy: req.user.id,
      creatorName: req.user.name,
      sourceKind,
      sourceId,
      sourceLabel: sourceLabel || "",
      publisherName: publisherName || sourceLabel || "",
      publisherType: publisherType || "solo"
    });

    return res.status(201).json({ publicTrack });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export async function votePublicTrackHandler(req, res) {
  try {
    const { trackId } = req.params;
    const { voteType } = req.body;
    if (!voteType || !["like", "dislike"].includes(voteType)) {
      return res.status(400).json({ error: "voteType must be like or dislike" });
    }

    const result = await votePublicTrack({ trackId, userId: req.user.id, voteType });
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }

    return res.status(200).json({ publicTrack: result.track });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export async function commentPublicTrackHandler(req, res) {
  try {
    const { trackId } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    const result = await addPublicComment({
      trackId,
      userId: req.user.id,
      userName: req.user.name,
      text: text.trim()
    });

    if (result.error) {
      return res.status(404).json({ error: result.error });
    }

    return res.status(200).json({ publicTrack: result.track, comment: result.comment });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export async function deletePublicTrackHandler(req, res) {
  try {
    const { trackId } = req.params;
    const result = await deletePublicTrack({ trackId, userId: req.user.id });
    if (result.error) {
      const status = result.error.includes("Forbidden") ? 403 : 404;
      return res.status(status).json({ error: result.error });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export function getLandingContentHandler(req, res) {
  try {
    const industryKey = req.query.industry || req.params.industryKey || "";
    return res.status(200).json({ landing: getLandingContent(industryKey) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
