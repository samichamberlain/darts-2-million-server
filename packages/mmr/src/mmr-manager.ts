//TODO
import {
  Listeners,
  ServerSocket,
  WebSocketCtx,
  type Emitters,
} from "@packages/websockets";
import z from "zod";

import { runTransaction } from "@packages/db";

const MMREmitters = {
  "score:get": z.number(),
} as const satisfies Emitters;

export function winSequence(
  winner: ServerSocket,
  loser: ServerSocket,
  lobbyId: string,
) {
  const mmr = calculateMmr(winner, loser);

  const winnerName = winner.data.username as string;
  const loserName = loser.data.username as string;

  //update user's mmr
  runTransaction(async (tx) => {
    await tx.user.update({
      where: { username: winnerName },
      data: { mmr: mmr[winnerName] },
    });

    await tx.user.update({
      where: { username: loserName },
      data: { mmr: mmr[loserName] },
    });
  });

  ctx.emit("score:get", mmr[winnerName], winner.id);
  ctx.emit("score:get", mmr[loserName], loser.id);

  loser.leave(lobbyId);
  winner.leave(lobbyId);

  ctx.resetSocketMetadata(loser);
  ctx.resetSocketMetadata(winner);
}

export const ctx = new WebSocketCtx({} as Listeners, MMREmitters);

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
  winner: ServerSocket,
  loser: ServerSocket,
): { [id: string]: number } {
  const winnerMmr = mmr(
    winner.data.mmr as number,
    loser.data.mmr as number,
    true,
  );

  const loserMmr = mmr(
    loser.data.mmr as number,
    winner.data.mmr as number,
    false,
  );

  return {
    [winner.data.username as string]: winnerMmr,
    [loser.data.username as string]: loserMmr,
  };
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
    return Math.max(mmrA + Math.max(MAX_MMR_GAIN * (S - E), MIN_MMR_GAIN), 0)
  else
    return Math.max(mmrA - Math.max(MAX_MMR_GAIN * (E - S), MIN_MMR_GAIN), 0);
}
