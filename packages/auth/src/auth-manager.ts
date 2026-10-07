//TODO
import { Emitters, WebSocketCtx, type Listeners } from "@packages/websockets";
import z from "zod";
import { mmrContext } from "../../mmr/index.ts";
const AuthListeners = {
  login: {
    req: z.object({
      username: z.string(),
      password: z.string(),
    }),
    res: z.boolean(),
  },
} as const satisfies Listeners;

const AuthEmitters = {
  "opponent:get": z.string(),
} as const satisfies Emitters;

console.log("Loading auth listener...");

export const ctx = new WebSocketCtx(AuthListeners, AuthEmitters);

ctx.on("login", (_socket, _args) => {
  console.log("logging in...", _socket.id);
  //TODO
  mmrContext.emit("score:get", -1);
  return true;
});
