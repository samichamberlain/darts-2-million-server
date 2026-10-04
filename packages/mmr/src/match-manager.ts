import { WebSocketCtx, type WebSocketCallbacks } from "@packages/websockets";
import z from "zod";

const MatchListeners = {
  "queue:join": z.null(),
  "match:cancel": z.null(),
  "match:ready": z.null(),
} as const satisfies WebSocketCallbacks;

const MatchEmitters = {
  "match:found": z.null(),
  "match:cancel": z.null(),
  "match:start": z.null(),
} as const satisfies WebSocketCallbacks;

export const ctx = new WebSocketCtx(MatchListeners, MatchEmitters);

ctx.on("queue:join", (socket) => {
  if (socket.data.lobbyId) return;

  ctx.roomQueue(socket);

  const lobbyId = socket.data.lobbyId;
  if (lobbyId && ctx.isLobbyFull(socket)) {
    ctx.emit("match:found", null, lobbyId);
  }
});

ctx.on("match:ready", (socket) => {
  const lobbyId = socket.data.lobbyId;
  if (!lobbyId || !ctx.isLobbyFull(socket)) return;

  socket.data.isReady = true;

  //wveryone in the lobby is ready
  if (ctx.allClientsReady(lobbyId)) ctx.emit("match:start", null, lobbyId);
});

ctx.on("match:cancel", (socket) => {
  const lobbyId = socket.data.lobbyId;
  if (!lobbyId) return;

  // Notify everyonethen empty the lobby
  ctx.emit("match:cancel", null, lobbyId);
  for (const member of [...(ctx.clientsInLobby(lobbyId) ?? [])]) {
    ctx.leaveLobby(member);
  }
});
