//TODO
import { Emitters, WebSocketCtx, type Listeners } from "@packages/websockets";
import z from "zod";
import { runTransaction } from "../../db/src/prisma.ts";

const LeaderboardListeners = {
  "leaderboard:request": {
    req: z.object({
      start: z.int().min(0),
      count: z.int().min(0),
    }),
  },
} as const satisfies Listeners;

const LeaderboardEmitters = {
  "leaderboard:sync": z.tuple([z.int(), z.string(), z.number()]),
} as const satisfies Emitters;

export const ctx = new WebSocketCtx(LeaderboardListeners, LeaderboardEmitters);

ctx.on("leaderboard:request", async (socket, args) => {
  const values = await runTransaction((tx) => {
    return tx.user.findMany({
      orderBy: { mmr: "desc" },
      skip: args.start,
      take: args.count,
    });
  });

  if (values) {
    for (const value of values) {
      const idx = values.indexOf(value);

      ctx.emit(
        "leaderboard:sync",
        [args.start + idx, value.username, value.mmr],
        socket.id,
      );
    }
  }
});
