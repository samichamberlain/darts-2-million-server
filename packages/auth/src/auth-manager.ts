//TODO
import { Emitters, WebSocketCtx, type Listeners } from "@packages/websockets";
import z from "zod";
import { mmrContext } from "../../mmr/index.ts";
import { runTransaction } from "../../db/src/prisma.ts";

const AuthListeners = {
  login: {
    req: z.object({
      username: z.string(),
      password: z.string(),
    }),
    res: z.boolean(),
  },
} as const satisfies Listeners;

const AuthEmitters = {
  "opponent:get": z.string(),
} as const satisfies Emitters;

export const ctx = new WebSocketCtx(AuthListeners, AuthEmitters);

ctx.on("login", async (socket, args) => {
  console.log("logging in...", socket.id);

  //check if the user has an account....
  let account = await runTransaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: {
        username: {
          equals: args.username,
          mode: "insensitive",
        },
      },
    });

    return user;
  });

  if (account) {
    socket.data.username = account?.username;
    socket.data.mmr = account?.mmr;
  }

  //validate password if the user's account already exists + emit mmr
  if (account) {
    mmrContext.emit("score:get", account.mmr);
    return account.password === args.password;
  }

  //create a new account
  else {
    account = await runTransaction((tx) => {
      return tx.user.create({
        data: {
          ...args,
        },
      });
    });
  }

  mmrContext.emit("score:get", 0);
  socket.data.username = account?.username;
  socket.data.mmr = account?.mmr;

  return true;
});
