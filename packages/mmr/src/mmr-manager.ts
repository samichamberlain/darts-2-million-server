//TODO
import { WebSocketCtx, type WebSocketCallbacks } from "@packages/websockets";
import z from "zod";

const MMRListeners = {
  "mmr:get": z.null(),
} as const satisfies WebSocketCallbacks;

const MMREmitters = {
  "mmr:get": z.number(),
} as const satisfies WebSocketCallbacks;

export const ctx = new WebSocketCtx(MMRListeners, MMREmitters);

ctx.on("mmr:get", (socket) => {
  //TODO
  const score = -1;
  ctx.emit("mmr:get", score, socket.id);
});
