declare module "../dist/app.js" {
  import type { Application } from "express";
  export function createApp(): Application;
}
