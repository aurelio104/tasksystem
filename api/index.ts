import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Application } from "express";
import { createApp } from "../dist/app.js";

let app: Application | undefined;

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!app) app = createApp();
  return app(req, res);
}
