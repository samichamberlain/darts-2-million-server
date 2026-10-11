import {
  WebSocketCtx,
  type Emitters,
  type Listeners,
} from "@packages/websockets";
import { checkForWin, winSequence } from "@packages/mmr";
import z from "zod";

const StateListeners = {
  "state:send": { req: z.string(), res: z.void() },
} as const satisfies Listeners;

const StateEmitters = {
  "state:sync": z.string(),
} as const satisfies Emitters;

export const ctx = new WebSocketCtx(StateListeners, StateEmitters);

ctx.on("state:send", (socket, payload, lobbyId) => {
  //send payload to other clients in room...

  const clients = ctx.clientsInLobby(lobbyId);

  console.log("has client won? ", checkForWin(payload));
  const win = checkForWin(payload);

  if (win) {
    const opponent = ctx.getOpponents(socket, lobbyId)[0];
    winSequence(socket, opponent, true);
    winSequence(opponent, socket, false);
  }

  if (!clients) return;

  for (const cli of clients) {
    if (cli.id === socket.id) continue;

    ctx.emit("state:sync", payload, cli.id);
  }
});
