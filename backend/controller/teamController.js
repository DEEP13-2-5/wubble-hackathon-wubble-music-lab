import {
  addVersion,
  createOrUpdatePublicTrack,
  createTeam,
  joinTeamByCode,
  listUserTeams,
  publishVersion,
  serializeTeam,
  userCanAccessTeam,
  voteVersion,
  getTeamById
} from "../model/store.js";

export async function createTeamHandler(req, res) {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Team name is required" });
    }

    const team = await createTeam({ name, ownerId: req.user.id });
    return res.status(201).json({ team: serializeTeam(team) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export async function joinTeamHandler(req, res) {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) {
      return res.status(400).json({ error: "inviteCode is required" });
    }

    const result = await joinTeamByCode({ inviteCode, userId: req.user.id });
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }

    return res.status(200).json({ team: serializeTeam(result.team) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export async function getMyTeamsHandler(req, res) {
  try {
    return res.status(200).json({ teams: await listUserTeams(req.user.id) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export async function getTeamStateHandler(req, res) {
  try {
    const { teamId } = req.params;
    if (!(await userCanAccessTeam({ userId: req.user.id, teamId }))) {
      return res.status(403).json({ error: "No access to this team" });
    }

    const team = await getTeamById(teamId);
    return res.status(200).json({ team: serializeTeam(team) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export async function createVersionHandler(req, res) {
  try {
    const { teamId } = req.params;
    const { name, track } = req.body;

    if (!(await userCanAccessTeam({ userId: req.user.id, teamId }))) {
      return res.status(403).json({ error: "No access to this team" });
    }

    if (!name || !track) {
      return res.status(400).json({ error: "name and track are required" });
    }

    const version = await addVersion({
      teamId,
      name,
      track,
      creatorId: req.user.id
    });

    return res.status(201).json({ version });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export async function voteVersionHandler(req, res) {
  try {
    const { teamId, versionId } = req.params;
    if (!(await userCanAccessTeam({ userId: req.user.id, teamId }))) {
      return res.status(403).json({ error: "No access to this team" });
    }

    const result = await voteVersion({ teamId, versionId, userId: req.user.id });
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }

    return res.status(200).json({ version: result.version });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export async function publishVersionHandler(req, res) {
  try {
    const { teamId, versionId } = req.params;
    if (!(await userCanAccessTeam({ userId: req.user.id, teamId }))) {
      return res.status(403).json({ error: "No access to this team" });
    }

    const result = await publishVersion({ teamId, versionId });
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }

    const team = await getTeamById(teamId);
    const version = team.versions.find((item) => item.id === versionId);
    if (version) {
      await createOrUpdatePublicTrack({
        track: version.track,
        createdBy: req.user.id,
        sourceKind: "team-version",
        sourceId: version.id,
        sourceLabel: team.name,
        publisherName: team.name,
        publisherType: "team"
      });
    }

    return res.status(200).json({ version: result.version });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
