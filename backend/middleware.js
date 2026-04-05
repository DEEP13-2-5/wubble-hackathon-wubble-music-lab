import { findUserByToken } from "./model/store.js";

export async function requireAuth(req, res, next) {
	try {
		const authHeader = req.headers.authorization || "";
		const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

		if (!token) {
			return res.status(401).json({ error: "Missing auth token" });
		}

		const user = await findUserByToken(token);
		if (!user) {
			return res.status(401).json({ error: "Invalid auth token" });
		}

		req.user = user;
		return next();
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
}
