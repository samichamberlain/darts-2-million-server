import {
  WebSocketCtx,
  type Emitters,
  type Listeners,
} from "@packages/websockets";
import z from "zod";

import { authContext } from "../../auth/index.ts";

const MatchListeners = {
  "queue:join": { res: z.void() },
  "match:cancel": { res: z.boolean() },
  "match:ready": { res: z.boolean() },

  "match:connected": { res: z.boolean() },
} as const satisfies Listeners;

const MatchEmitters = {
  "match:found": z.null(),
  "match:cancel": z.null(),
  "match:start": z.null(),

  "match:connected": z.boolean(),
} as const satisfies Emitters;

export const ctx = new WebSocketCtx(MatchListeners, MatchEmitters);

//health check
ctx.on("match:connected", () => {
  return true;
});

ctx.on("queue:join", (socket) => {
  ctx.joinQueue(socket);
});

ctx.onLobbyCreate((lobbyId) => {
  ctx.emit("match:found", null, lobbyId);
  authContext.emit("opponent:get", "poopy"); //TODO
});

ctx.onLobbyDelete((lobbyId) => {
  ctx.emit("match:cancel", null, lobbyId);
});

ctx.onLobbyReady((lobbyId) => {
  ctx.emit("match:start", null, lobbyId);
});

ctx.on("match:ready", (socket) => {
  ctx.readyClient(socket);
  return true;
});

ctx.on("match:cancel", (socket, _payload, lobbyId) => {
  if (!lobbyId) {
    ctx.leaveQueue(socket);
    return true;
  }

  ctx.leaveLobby(socket);
  ctx.emit("match:cancel", null, lobbyId);

  return true;
});
