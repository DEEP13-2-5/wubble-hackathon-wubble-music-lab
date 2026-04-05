import { createSession, createUser, sanitizeUser, verifyUser } from "../model/store.js";

export async function signup(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email and password are required" });
    }

    const result = await createUser({ name, email, password });
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    const token = await createSession(result.user.id);
    return res.status(201).json({
      token,
      user: sanitizeUser(result.user)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await verifyUser(email, password);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = await createSession(user.id);
    return res.status(200).json({
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export async function me(req, res) {
  try {
    return res.status(200).json({
      user: sanitizeUser(req.user)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
