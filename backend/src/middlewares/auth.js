import jwt from "jsonwebtoken";

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: "Token invalide" });
  }

  const token = authHeader.split(' ')[1];
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  req.user = { userId: payload.userId, role: payload.role };

  next();
}