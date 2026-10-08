import {
  WebSocketCtx,
  type Emitters,
  type Listeners,
} from "@packages/websockets";
import { Socket } from "https://deno.land/x/socket_io@0.2.0/mod.ts";
import z from "zod";

const ShopListeners = {
  "shop:send": { req: z.string(), res: z.void() },
} as const satisfies Listeners;

const ShopEmitters = {
  "shop:sync": z.string(),
} as const satisfies Emitters;

export const ctx = new WebSocketCtx(ShopListeners, ShopEmitters);

ctx.on("shop:send", (socket, payload, lobbyId) => {
  //send payload to other clients in room...

  console.log("Syncing client shops...");

  const clients = ctx.clientsInLobby(lobbyId);

  console.log(clients);

  if (!clients) return;

  for (const cli of clients) {
    if (cli.id === socket.id) continue;

    ctx.emit("shop:sync", payload, cli.id);
  }
});
