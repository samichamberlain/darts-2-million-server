import {
  WebSocketCtx,
  type Emitters,
  type Listeners,
} from "@packages/websockets";
import z from "zod";

import { authContext } from "../../auth/index.ts";

const MatchListeners = {
  "queue:join": { req: z.null(), res: z.void() },
  "match:cancel": { req: z.null(), res: z.boolean() },
  "match:ready": { req: z.null(), res: z.boolean() },

  "match:connected": { req: z.null(), res: z.boolean() },
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
  ctx.roomQueue(socket);

  const lobbyId = socket.data.lobbyId;
  if (lobbyId && ctx.isLobbyFull(socket)) {
    ctx.emit("match:found", null, lobbyId);
    authContext.emit("opponent:get", "poopy"); //TODO
  }
});

ctx.on("match:ready", (socket) => {
  const lobbyId = socket.data.lobbyId;
  if (!lobbyId || !ctx.isLobbyFull(socket)) return false;

  socket.data.isReady = true;

  //wveryone in the lobby is ready
  if (ctx.allClientsReady(lobbyId)) ctx.emit("match:start", null, lobbyId);

  return true;
});

ctx.on("match:cancel", (socket) => {
  const lobbyId = socket.data.lobbyId;
  if (!lobbyId) return false;

  // Notify everyonethen empty the lobby
  ctx.emit("match:cancel", null, lobbyId);
  for (const member of [...(ctx.clientsInLobby(lobbyId) ?? [])]) {
    ctx.leaveLobby(member);
  }

  return true;
});
