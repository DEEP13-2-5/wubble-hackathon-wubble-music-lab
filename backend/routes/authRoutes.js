import express from "express";
import { login, me, signup } from "../controller/authController.js";
import { requireAuth } from "../middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", requireAuth, me);

export default router;
