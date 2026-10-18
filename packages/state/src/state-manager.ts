import {
  WebSocketCtx,
  type Emitters,
  type Listeners,
} from "@packages/websockets";
import { setClientScore, winSequence } from "@packages/mmr";
import z from "zod";

const StateListeners = {
  "state:send": { req: z.string(), res: z.void() },
} as const satisfies Listeners;

const StateEmitters = {
  "state:sync": z.string(),
  "bot:gameover": z.object({ botMmr: z.number(), won: z.boolean() }),
} as const satisfies Emitters;

export const ctx = new WebSocketCtx(StateListeners, StateEmitters);

ctx.on("state:send", (socket, payload, lobbyId) => {
  //send payload to other clients in room...

  const clients = ctx.clientsInLobby(lobbyId);

  if (!clients) {
    console.error(
      `[state::send] No clients to send data to for lobby ${lobbyId}`,
    );
    return;
  }

  setClientScore(socket, payload);
  const opponent = ctx.getOpponents(socket, lobbyId)[0];

  console.log("OPPONENT: " + opponent);

  if (opponent) {
    if (Number(socket.data.score) <= 0) {
      console.log(`Host won! Socket ID: ${socket.id}`);
      winSequence(socket, opponent, lobbyId);
    } else if (Number(opponent.data.score) <= 0) {
      console.log(`Opponent won! Socket ID: ${opponent.id}`);
      winSequence(opponent, socket, lobbyId);
    }
  }

  for (const cli of clients) {
    if (cli.id === socket.id) continue;

    ctx.emit("state:sync", payload, cli.id);
  }
});
