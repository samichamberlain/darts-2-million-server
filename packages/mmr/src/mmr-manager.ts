//TODO
import { WebSocketCtx, type Listeners } from "@packages/websockets";
import z from "zod";

const MMRListeners = {
  "mmr:get": { req: z.null(), res: z.number() },
} as const satisfies Listeners;

export const ctx = new WebSocketCtx(MMRListeners);

ctx.on("mmr:get", () => {
  //TODO
  const score = -1;
  return score;
});
