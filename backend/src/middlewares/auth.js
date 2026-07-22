import jwt from "jsonwebtoken";

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: "Token invalide" });
  }

  const [, token] = authHeader.split(' ');

  try {
    const { userId, role } = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { userId, role };
  } catch {
    return res.status(401).json({ error: "Token invalide" });
  }

  next();
}