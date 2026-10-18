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
  "bot:start": {},
} as const satisfies Listeners;

const MatchEmitters = {
  "match:found": z.null(),
  "match:cancel": z.null(),
  "match:start": z.null(),

  "match:connected": z.boolean(),
  "offer:bot": z.null(),
} as const satisfies Emitters;

export const ctx = new WebSocketCtx(MatchListeners, MatchEmitters);

const queueTimers = new Map<string, NodeJS.Timeout>();
const BOT_TIMEOUT = 10000;

//health check
ctx.on("match:connected", () => {
  return true;
});

ctx.on("queue:join", (socket) => {
  ctx.joinQueue(socket);

  //start timer for socket queue... send bot match request after BOT_TIMEOUT seconds in the queue
  queueTimers.set(
    socket.id,
    setTimeout(() => {
      ctx.emit("offer:bot", null, socket.id);
      ctx.leaveQueue(socket);
    }, BOT_TIMEOUT),
  );
});

ctx.onLobbyCreate((lobbyId) => {
  ctx.emit("match:found", null, lobbyId);

  //get other player in lobby
  const players = ctx.clientsInLobby(lobbyId);

  if (players) {
    players.forEach((p) => {
      const lobby = p.id;

      //Remove the flag for giving this socket a bot, if applicable.
      clearTimeout(queueTimers.get(p.id));

      //Clear bot match timer
      if (queueTimers.get(p.id)) {
        clearTimeout(queueTimers.get(p.id));
        queueTimers.delete(p.id);
      }

      const other = [...players].find(
        (px) => px.data.username != p.data.username,
      );

      authContext.emit(
        "opponent:get",
        other?.data.username ?? "Paul Fart",
        lobby,
      );
    });
  }
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
  //Remove the flag for giving this socket a bot, if applicable.
  clearTimeout(queueTimers.get(socket.id));

  if (!lobbyId) {
    ctx.leaveQueue(socket);
    return true;
  }

  ctx.leaveLobby(socket);
  ctx.emit("match:cancel", null, lobbyId);

  return true;
});

ctx.on("bot:start", (socket) => {
  socket.data.isInBotMatch = true;

  //Remove the flag for giving this socket a bot, if applicable.
  clearTimeout(queueTimers.get(socket.id));
});
