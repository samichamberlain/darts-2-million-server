import {
  WebSocketCtx,
  type Emitters,
  type Listeners,
} from "@packages/websockets";
import z from "zod";

const ShopListeners = {
  "shop:send": { req: z.string(), res: z.void() },
} as const satisfies Listeners;

const ShopEmitters = {
  "shop:sync": z.string(),
} as const satisfies Emitters;

export const ctx = new WebSocketCtx(ShopListeners, ShopEmitters);

ctx.on("shop:send", (socket, payload) => {
  //send payload to other clients in room...
  const lobby = socket.data.lobbyId;

  if (!lobby) return;

  const clients = ctx.clientsInLobby(lobby);

  if (!clients) return;

  for (const cli of clients) {
    if (cli.id == socket.id) continue;
    ctx.emit("shop:sync", payload, cli.id);
  }
});
//TODO
