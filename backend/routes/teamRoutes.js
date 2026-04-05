import express from "express";
import {
  createTeamHandler,
  createVersionHandler,
  getMyTeamsHandler,
  getTeamStateHandler,
  joinTeamHandler,
  publishVersionHandler,
  voteVersionHandler
} from "../controller/teamController.js";
import { requireAuth } from "../middleware.js";

const router = express.Router();

router.use(requireAuth);

router.get("/mine", getMyTeamsHandler);
router.post("/create", createTeamHandler);
router.post("/join", joinTeamHandler);
router.get("/:teamId", getTeamStateHandler);
router.post("/:teamId/versions", createVersionHandler);
router.post("/:teamId/versions/:versionId/vote", voteVersionHandler);
router.post("/:teamId/versions/:versionId/publish", publishVersionHandler);

export default router;
