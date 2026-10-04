//TODO
import {
  WebSocketCtx,
  type Listeners,
  type Emitters,
} from "@packages/websockets";
import z from "zod";

const MMRListeners = {
  login: {
    req: z.object({
      username: z.string(),
      password: z.string(),
    }),
    res: z.boolean(),
  },

  "opponent:get": {
    res: z.string(),
  },
} as const satisfies Listeners;

export const ctx = new WebSocketCtx(MMRListeners);

ctx.on("login", (_socket, _args) => {
  //TODO
  return true;
});

ctx.on("opponent:get", (_socket) => {
  //TODO
  return "poopy";
});
