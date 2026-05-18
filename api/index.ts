import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp } from "../dist/app.js";

let app: ReturnType<typeof createApp> | undefined;

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!app) app = createApp();
  return app(req, res);
}
