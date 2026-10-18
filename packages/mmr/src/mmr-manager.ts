//TODO
import {
  Listeners,
  ServerSocket,
  WebSocketCtx,
  io,
  type Emitters,
} from "@packages/websockets";
import z from "zod";

import { runTransaction } from "@packages/db";

// const RAGE_QUIT_MMR_LOSS = 100;

const MMREmitters = {
  "score:get": z.number(),
} as const satisfies Emitters;

const MMRListeners = {
  "bot:gameover": {
    req: z.object({
      win: z.boolean(),
      botMmr: z.number(),
    }),
  },
} as const satisfies Listeners;

// io.on("connection", (socket) => {
//   socket.on("disconnecting", () => {
//     console.log(socket.data);

//     // if (isInlobby) {
//     //   //They lose.... ragequit!
//     //   loseMmrRageQuit(socket as ServerSocket);
//     // }
//   });
// });

export const ctx = new WebSocketCtx(MMRListeners, MMREmitters);

ctx.on("bot:gameover", (socket, payload, lobbyId) => {
  checkBotGameWin(socket, payload.win, payload.botMmr, lobbyId);
});

// export function loseMmrRageQuit(socket: ServerSocket) {
//   console.log("RAGE QUIT");
//   if (!socket.data.mmr || !socket.data.username) return;

//   const mmr = Math.max(socket.data.mmr - RAGE_QUIT_MMR_LOSS, 0);
//   const username = socket.data.username ?? "";
//   //update user's mmr
//   runTransaction(async (tx) => {
//     await tx.user.update({
//       where: { username },
//       data: { mmr },
//     });
//   });
// }

export function checkBotGameWin(
  socket: ServerSocket,
  win: boolean,
  botMmr: number,
  lobbyId: string,
) {
  // For practice -- bot mode but not
  if (!socket.data.isInBotMatch) return;

  const mmr = calculateMmr(socket.data.mmr as number, botMmr, win);
  runTransaction(async (tx) => {
    await tx.user.update({
      where: { username: socket.data.username },
      data: { mmr },
    });
  });

  ctx.emit("score:get", mmr, socket.id);

  socket.leave(lobbyId);
  socket.data.mmr = mmr;
  ctx.resetSocketMetadata(socket);
}

export function winSequence(
  winner: ServerSocket,
  loser: ServerSocket,
  lobbyId: string,
) {
  console.log("calling win...", winner.id, loser.id);
  const winnerMmr = calculateMmr(
    winner.data.mmr as number,
    loser.data.mmr as number,
    true,
  );
  const loserMmr = calculateMmr(
    loser.data.mmr as number,
    winner.data.mmr as number,
    false,
  );

  console.log(`MMR WINNER: ${winnerMmr}`, `MMR LOSER: ${loserMmr}`);

  const winnerName = winner.data.username as string;
  const loserName = loser.data.username as string;

  //update user's mmr
  runTransaction(async (tx) => {
    await tx.user.update({
      where: { username: winnerName },
      data: { mmr: winnerMmr },
    });

    await tx.user.update({
      where: { username: loserName },
      data: { mmr: loserMmr },
    });
  });

  ctx.emit("score:get", winnerMmr, winner.id);
  ctx.emit("score:get", loserMmr, loser.id);

  loser.leave(lobbyId);
  winner.leave(lobbyId);

  winner.data.mmr = winnerMmr;
  loser.data.mmr = loserMmr;

  ctx.resetSocketMetadata(loser);
  ctx.resetSocketMetadata(winner);
}

export function setClientScore(socket: ServerSocket, payload: string): void {
  const bytes = JSON.parse(payload);
  const byteArray = new Uint8Array(Object.values(bytes));

  // console.log(byteArray);
  //0-4 -- payload_idx
  //4-8 -- processed_darts
  //8-12 -- shot_stats.darts_per_shot
  //12-16 -- monkey_stats.shots_per_second
  //16-20 -- monkey_stats.darts_per_shot
  //20-24 -- monkey_stats.aim_focus
  const numDarts = new DataView(
    byteArray.buffer,
    byteArray.byteOffset,
    byteArray.byteLength,
  ).getUint32(4, true);

  socket.data.score = 1_000_000 - numDarts;
}

export function calculateMmr(
  user: number,
  opponent: number,
  win: boolean,
): number {
  return mmr(user, opponent, win);

  // const loserMmr = mmr(
  //   loser.data.mmr as number,
  //   winner.data.mmr as number,
  //   false,
  // );

  // return {
  //   [winner.data.username as string]: winnerMmr,
  //   [loser.data.username as string]: loserMmr,
  // };
}

const MMR_PROBABILITY_FACTOR: number = 10;
const MAX_MMR_WIN = 600;
const MAX_MMR_LOSE = 200;
const MIN_MMR_GAIN = 10;

function mmr(mmrA: number, mmrB: number, winner: boolean) {
  const E = 1 / (1 + Math.pow(10, (mmrB - mmrA) / MMR_PROBABILITY_FACTOR));
  const S = winner ? 1 : 0;
  const MAX_MMR_GAIN = winner ? MAX_MMR_WIN : MAX_MMR_LOSE;

  if (winner)
    return Math.round(
      Math.max(mmrA + Math.max(MAX_MMR_GAIN * (S - E), MIN_MMR_GAIN), 0),
    );
  else
    return Math.round(
      Math.max(mmrA - Math.max(MAX_MMR_GAIN * (E - S), MIN_MMR_GAIN), 0),
    );
}
