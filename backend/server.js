import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import authRoutes from "./routes/authRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import musicRoutes from "./routes/musicRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import { connectDatabase } from "./model/db.js";
import {
	addChatMessage,
	addVersion,
	createOrUpdatePublicTrack,
	findUserByToken,
	getUserById,
	getTeamById,
	publishVersion,
	serializeTeam,
	userCanAccessTeam,
	voteVersion
} from "./model/store.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
	cors: {
		origin: process.env.FRONTEND_ORIGIN || "*"
	}
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
	res.status(200).json({ ok: true, service: "music-app-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/music", musicRoutes);
app.use("/api/public", publicRoutes);

io.on("connection", (socket) => {
	socket.on("joinTeam", async ({ teamId, token }) => {
		const user = await findUserByToken(token);
		if (!user || !(await userCanAccessTeam({ userId: user.id, teamId }))) {
			socket.emit("teamError", { message: "Join failed: unauthorized" });
			return;
		}

		socket.join(teamId);
		const team = await getTeamById(teamId);
		socket.emit("teamStateUpdated", { team: serializeTeam(team) });
	});

	socket.on("teamMessage", async ({ teamId, token, text }) => {
		const user = await findUserByToken(token);
		if (!user || !(await userCanAccessTeam({ userId: user.id, teamId }))) {
			socket.emit("teamError", { message: "Message failed: unauthorized" });
			return;
		}

		if (!text || typeof text !== "string") {
			return;
		}

		await addChatMessage({ teamId, userId: user.id, userName: user.name, text: text.trim() });
		const team = await getTeamById(teamId);
		io.to(teamId).emit("teamStateUpdated", { team: serializeTeam(team) });
	});

	socket.on("createVersion", async ({ teamId, token, name, track }) => {
		const user = await findUserByToken(token);
		if (!user || !(await userCanAccessTeam({ userId: user.id, teamId }))) {
			socket.emit("teamError", { message: "Create version failed: unauthorized" });
			return;
		}

		if (!name || !track) {
			socket.emit("teamError", { message: "name and track required" });
			return;
		}

		await addVersion({ teamId, name, track, creatorId: user.id });
		const team = await getTeamById(teamId);
		io.to(teamId).emit("teamStateUpdated", { team: serializeTeam(team) });
	});

	socket.on("voteVersion", async ({ teamId, token, versionId }) => {
		const user = await findUserByToken(token);
		if (!user || !(await userCanAccessTeam({ userId: user.id, teamId }))) {
			socket.emit("teamError", { message: "Vote failed: unauthorized" });
			return;
		}

		const result = await voteVersion({ teamId, versionId, userId: user.id });
		if (result.error) {
			socket.emit("teamError", { message: result.error });
			return;
		}

		const team = await getTeamById(teamId);
		io.to(teamId).emit("teamStateUpdated", { team: serializeTeam(team) });
	});

	socket.on("publishVersion", async ({ teamId, token, versionId }) => {
		const user = await findUserByToken(token);
		if (!user || !(await userCanAccessTeam({ userId: user.id, teamId }))) {
			socket.emit("teamError", { message: "Publish failed: unauthorized" });
			return;
		}

		const result = await publishVersion({ teamId, versionId });
		if (result.error) {
			socket.emit("teamError", { message: result.error });
			return;
		}

		const team = await getTeamById(teamId);
		const version = team.versions.find((item) => item.id === versionId);
		if (version) {
			const creatorId = version.creatorId || user.id;
			const creator = await getUserById(creatorId);
			await createOrUpdatePublicTrack({
				track: version.track,
				createdBy: creatorId,
				creatorName: creator?.name || user.name,
				sourceKind: "team-version",
				sourceId: version.id,
				sourceTeamId: teamId,
				sourceLabel: team.name,
				publisherName: team.name,
				publisherType: "team"
			});
		}
		io.to(teamId).emit("teamStateUpdated", { team: serializeTeam(team) });
	});
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In production serve from the React build output; in dev the Vite dev server handles it
const frontendDir = path.join(__dirname, "../frontend/dist");

app.use(express.static(frontendDir));
app.get("*", (_req, res) => {
	const indexPath = path.join(frontendDir, "index.html");
	res.sendFile(indexPath, (err) => {
		if (err) res.status(404).json({ error: "Frontend not built. Run: cd frontend && npm run build" });
	});
});

const port = Number(process.env.PORT || 4000);

async function startServer() {
	await connectDatabase();
	httpServer.listen(port, () => {
		console.log(`Backend running on http://localhost:${port}`);
	});
}

startServer().catch((error) => {
	console.error("Startup failed", error);
	process.exit(1);
});
