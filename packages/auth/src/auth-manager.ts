//TODO
import { WebSocketCtx, type WebSocketCallbacks } from "@packages/websockets";
import z from "zod";

const MMRListeners = {
  login: z.object({
    username: z.string(),
    password: z.string(),
  }),

  "opponent:get": z.null(),
} as const satisfies WebSocketCallbacks;

const MMREmitters = {
  login: z.boolean(),
  "opponent:get": z.string(),
} as const satisfies WebSocketCallbacks;

export const ctx = new WebSocketCtx(MMRListeners, MMREmitters);

ctx.on("login", (socket, _args) => {
  //TODO
  ctx.emit("login", true, socket.id);
});

ctx.on("opponent:get", (socket) => {
  //TODO
  ctx.emit("opponent:get", "poopy", socket.id);
});
