import express from "express";
import {
  commentPublicTrackHandler,
  getLandingContentHandler,
  listPublicTracksHandler,
  publishPublicTrackHandler,
  votePublicTrackHandler,
  deletePublicTrackHandler
} from "../controller/publicController.js";
import { requireAuth } from "../middleware.js";

const router = express.Router();

router.get("/landing", getLandingContentHandler);
router.get("/landing/:industryKey", getLandingContentHandler);
router.get("/tracks", listPublicTracksHandler);
router.post("/tracks", requireAuth, publishPublicTrackHandler);
router.post("/tracks/:trackId/vote", requireAuth, votePublicTrackHandler);
router.post("/tracks/:trackId/comment", requireAuth, commentPublicTrackHandler);
router.delete("/tracks/:trackId", requireAuth, deletePublicTrackHandler);

export default router;
