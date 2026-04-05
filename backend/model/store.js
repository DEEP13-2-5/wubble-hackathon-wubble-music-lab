import crypto from "crypto";
import mongoose from "mongoose";

const sampleTracks = [
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
];

const chatMessageSchema = new mongoose.Schema(
  {
    id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true },
    userName: { type: String, default: "" },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const versionSchema = new mongoose.Schema(
  {
    id: { type: String, default: () => crypto.randomUUID() },
    name: { type: String, required: true },
    track: { type: mongoose.Schema.Types.Mixed, required: true },
    creatorId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    voterIds: { type: [String], default: [] },
    lyrics: { type: String, default: "" }
  },
  { _id: false }
);

const publicTrackSchema = new mongoose.Schema(
  {
    id: { type: String, default: () => crypto.randomUUID() },
    sourceKind: { type: String, required: true },
    sourceId: { type: String, required: true, index: true },
    sourceTeamId: { type: String, default: "", index: true },
    title: { type: String, required: true },
    prompt: { type: String, default: "" },
    audioUrl: { type: String, required: true },
    createdBy: { type: String, required: true },
    creatorName: { type: String, default: "" },
    sourceLabel: { type: String, default: "" },
    publisherName: { type: String, default: "" },
    publisherType: { type: String, default: "solo" },
    animationStyle: { type: String, default: "nebula" },
    animationSeed: { type: Number, default: 0 },
    publishedAt: { type: Date, default: Date.now },
    comments: { type: [mongoose.Schema.Types.Mixed], default: [] },
    likeUserIds: { type: [String], default: [] },
    dislikeUserIds: { type: [String], default: [] },
    lyrics: { type: String, default: "" }
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    teamIds: { type: [String], default: [] }
  },
  { timestamps: true }
);

const sessionSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true }
  },
  { timestamps: true }
);

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    ownerId: { type: String, required: true },
    inviteCode: { type: String, required: true, unique: true, index: true },
    memberIds: { type: [String], default: [] },
    chat: { type: [chatMessageSchema], default: [] },
    versions: { type: [versionSchema], default: [] },
    publishedVersionId: { type: String, default: null },
    playlist: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Session = mongoose.models.Session || mongoose.model("Session", sessionSchema);
const Team = mongoose.models.Team || mongoose.model("Team", teamSchema);
const PublicTrack = mongoose.models.PublicTrack || mongoose.model("PublicTrack", publicTrackSchema);

function toPlainTeam(team) {
  if (!team) {
    return null;
  }

  const source = typeof team.toObject === "function" ? team.toObject() : team;
  const plainMessages = (source.chat || []).map((message) => ({
    ...message,
    createdAt: new Date(message.createdAt).toISOString()
  }));

  const plainVersions = (source.versions || []).map((version) => {
    const voterIds = version.voterIds || [];
    return {
      ...version,
      createdAt: new Date(version.createdAt).toISOString(),
      voteCount: voterIds.length,
      // Frontend compatibility aliases (React build expects votes)
      votes: voterIds,
      voterIds,
      lyrics: version.lyrics || ""
    };
  });

  return {
    id: String(source._id),
    _id: String(source._id),
    name: source.name,
    ownerId: source.ownerId,
    inviteCode: source.inviteCode,
    memberIds: source.memberIds || [],
    // Frontend compatibility aliases (React build expects members)
    members: source.memberIds || [],
    chat: plainMessages,
    // Frontend compatibility aliases (React build expects messages)
    messages: plainMessages,
    versions: plainVersions,
    publishedVersionId: source.publishedVersionId || null,
    playlist: source.playlist || []
  };
}

function toPlainPublicTrack(track) {
  if (!track) {
    return null;
  }

  const source = typeof track.toObject === "function" ? track.toObject() : track;
  return {
    id: String(source._id),
    _id: String(source._id),
    sourceKind: source.sourceKind,
    sourceId: source.sourceId,
    sourceTeamId: source.sourceTeamId || "",
    title: source.title,
    prompt: source.prompt || "",
    audioUrl: source.audioUrl,
    createdBy: source.createdBy,
    creatorName: source.creatorName || "",
    sourceLabel: source.sourceLabel || "",
    publisherName: source.publisherName || source.sourceLabel || "",
    publisherType: source.publisherType || "solo",
    animationStyle: source.animationStyle || "nebula",
    animationSeed: source.animationSeed || 0,
    publishedAt: new Date(source.publishedAt || source.createdAt).toISOString(),
    comments: source.comments || [],
    likeUserIds: source.likeUserIds || [],
    dislikeUserIds: source.dislikeUserIds || [],
    likeCount: (source.likeUserIds || []).length,
    dislikeCount: (source.dislikeUserIds || []).length,
    lyrics: source.lyrics || ""
  };
}

export function hashText(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function createSession(userId) {
  const token = crypto.randomBytes(24).toString("hex");
  await Session.create({ token, userId });
  return token;
}

export async function findUserByToken(token) {
  const session = await Session.findOne({ token }).lean();
  if (!session) {
    return null;
  }

  const user = await User.findById(session.userId).lean();
  if (!user) {
    return null;
  }

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    teamIds: user.teamIds || []
  };
}

export function sanitizeUser(user) {
  return {
    id: user.id || String(user._id),
    name: user.name,
    email: user.email,
    teamIds: user.teamIds || []
  };
}

export async function createUser({ name, email, password }) {
  const existing = await User.findOne({ email: email.toLowerCase() }).lean();
  if (existing) {
    return { error: "Email already exists" };
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash: hashText(password),
    teamIds: []
  });

  return {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      teamIds: user.teamIds
    }
  };
}

export async function verifyUser(email, password) {
  const user = await User.findOne({ email: email.toLowerCase() }).lean();
  if (!user) {
    return null;
  }

  if (user.passwordHash !== hashText(password)) {
    return null;
  }

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    teamIds: user.teamIds || []
  };
}

export async function getUserById(userId) {
  if (!userId) return null;
  const user = await User.findById(userId).lean();
  if (!user) return null;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    teamIds: user.teamIds || []
  };
}

export async function createTeam({ name, ownerId }) {
  const inviteCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  const team = await Team.create({
    name,
    ownerId,
    inviteCode,
    memberIds: [ownerId],
    chat: [],
    versions: [],
    publishedVersionId: null,
    playlist: []
  });

  await User.findByIdAndUpdate(ownerId, { $addToSet: { teamIds: String(team._id) } });
  return team;
}

export async function joinTeamByCode({ inviteCode, userId }) {
  const team = await Team.findOne({ inviteCode: inviteCode.toUpperCase() });
  if (!team) {
    return { error: "Invalid invite code" };
  }

  if (!team.memberIds.includes(userId)) {
    team.memberIds.push(userId);
    await team.save();
  }

  await User.findByIdAndUpdate(userId, { $addToSet: { teamIds: String(team._id) } });
  return { team };
}

export async function getTeamById(teamId) {
  return Team.findById(teamId);
}

export async function userCanAccessTeam({ userId, teamId }) {
  const count = await Team.countDocuments({ _id: teamId, memberIds: userId });
  return count > 0;
}

export async function addChatMessage({ teamId, userId, userName, text }) {
  const team = await Team.findById(teamId);
  if (!team) {
    return null;
  }

  let resolvedUserName = userName || "";
  if (!resolvedUserName) {
    const user = await User.findById(userId).lean();
    resolvedUserName = user?.name || "";
  }

  const message = {
    id: crypto.randomUUID(),
    userId,
    userName: resolvedUserName,
    text,
    createdAt: new Date().toISOString()
  };

  team.chat.push(message);
  await team.save();
  return message;
}

export async function addVersion({ teamId, name, track, creatorId }) {
  const team = await Team.findById(teamId);
  if (!team) {
    return null;
  }

  const version = {
    id: crypto.randomUUID(),
    name,
    track,
    creatorId,
    createdAt: new Date().toISOString(),
    voterIds: []
  };

  team.versions.push(version);
  team.playlist.push(track);
  await team.save();
  return version;
}

export async function voteVersion({ teamId, versionId, userId }) {
  const team = await Team.findById(teamId);
  if (!team) {
    return { error: "Team not found" };
  }

  const version = team.versions.find((item) => item.id === versionId);
  if (!version) {
    return { error: "Version not found" };
  }

  if ((version.voterIds || []).includes(userId)) {
    version.voterIds = version.voterIds.filter((id) => id !== userId);
  } else {
    version.voterIds.push(userId);
  }

  await team.save();
  return { version };
}

export async function publishVersion({ teamId, versionId }) {
  const team = await Team.findById(teamId);
  if (!team) {
    return { error: "Team not found" };
  }

  const version = team.versions.find((item) => item.id === versionId);
  if (!version) {
    return { error: "Version not found" };
  }

  team.publishedVersionId = versionId;
  await team.save();
  return { version };
}

export async function createOrUpdatePublicTrack({ track, createdBy, creatorName = "", sourceKind, sourceId, sourceTeamId = "", sourceLabel = "", publisherName = "", publisherType = "solo" }) {
  const payload = {
    sourceKind,
    sourceId,
    sourceTeamId,
    title: track.title,
    prompt: track.prompt || "",
    audioUrl: track.audioUrl,
    createdBy,
    creatorName,
    sourceLabel,
    publisherName: publisherName || sourceLabel,
    publisherType,
    animationStyle: track.animationStyle || "nebula",
    animationSeed: track.animationSeed || 0,
    lyrics: track.lyrics || "",
    publishedAt: new Date()
  };

  const existing = await PublicTrack.findOne({ sourceKind, sourceId });
  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    return existing;
  }

  return PublicTrack.create(payload);
}

export async function listPublicTracks() {
  const tracks = await PublicTrack.find().sort({ publishedAt: -1 });
  return tracks.map((track) => toPlainPublicTrack(track));
}

export async function votePublicTrack({ trackId, userId, voteType }) {
  const track = await PublicTrack.findById(trackId);
  if (!track) {
    return { error: "Public track not found" };
  }

  const isLike = voteType === "like";
  const activeField = isLike ? "likeUserIds" : "dislikeUserIds";
  const oppositeField = isLike ? "dislikeUserIds" : "likeUserIds";

  const activeList = track[activeField] || [];
  const oppositeList = track[oppositeField] || [];

  if (activeList.includes(userId)) {
    track[activeField] = activeList.filter((id) => id !== userId);
  } else {
    track[activeField] = [...activeList.filter((id) => id !== userId), userId];
    track[oppositeField] = oppositeList.filter((id) => id !== userId);
  }

  await track.save();
  return { track: toPlainPublicTrack(track) };
}

export async function addPublicComment({ trackId, userId, userName, text }) {
  const track = await PublicTrack.findById(trackId);
  if (!track) {
    return { error: "Public track not found" };
  }

  const comment = {
    id: crypto.randomUUID(),
    userId,
    userName,
    text,
    createdAt: new Date().toISOString()
  };

  track.comments = [...(track.comments || []), comment];
  await track.save();
  return { comment, track: toPlainPublicTrack(track) };
}

export async function deletePublicTrack({ trackId, userId }) {
  const track = await PublicTrack.findById(trackId);
  if (!track) {
    return { error: "Public track not found" };
  }

  if (String(track.createdBy) !== String(userId)) {
    return { error: "Forbidden: You are not the creator of this track" };
  }

  await track.deleteOne();
  return { success: true };
}

export function createMockTrack(prompt) {
  const randomTrack = sampleTracks[Math.floor(Math.random() * sampleTracks.length)];
  const animationStyles = ["nebula", "wave", "storm", "spiral", "shards"];

  return {
    id: crypto.randomUUID(),
    title: `Generated: ${prompt.slice(0, 24) || "Untitled"}`,
    prompt,
    audioUrl: randomTrack,
    createdAt: new Date().toISOString(),
    animationStyle: animationStyles[Math.floor(Math.random() * animationStyles.length)],
    animationSeed: Math.floor(Math.random() * 100000)
  };
}

export function serializeTeam(team) {
  return toPlainTeam(team);
}

export async function listUserTeams(userId) {
  const teams = await Team.find({ memberIds: userId });
  return teams.map((team) => toPlainTeam(team));
}
