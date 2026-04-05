import express from "express";
import multer from "multer";
import {
	generateMusicAsyncHandler,
	generateMusicHandler,
	generateWithVoiceHandler,
	getGenerationStatusHandler,
	proxyAudioHandler,
	uploadVoiceHandler
} from "../controller/musicController.js";
import { requireAuth } from "../middleware.js";

const router = express.Router();
const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 25 * 1024 * 1024
	}
});

router.post("/generate", requireAuth, generateMusicHandler);
router.post("/generate-async", requireAuth, generateMusicAsyncHandler);
router.get("/requests/:requestId", requireAuth, getGenerationStatusHandler);
router.get("/proxy-audio", proxyAudioHandler);
router.post("/upload-voice", requireAuth, upload.single("file"), uploadVoiceHandler);
router.post("/generate-with-voice", requireAuth, upload.single("file"), generateWithVoiceHandler);

export default router;
