import { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth";

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { identifier, password } = req.body;
    const result = await authService.login(identifier, password);

    req.session.userId = result.user.id;

    res.json({ user: result.user });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.session.userId) {
      res.status(401).json({ error: { message: "Not authenticated" } });
      return;
    }

    const user = await authService.getMe(req.session.userId);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
