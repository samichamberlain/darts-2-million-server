import { io } from "@packages/websockets";
import "@packages/mmr";
import "@packages/auth";
import "@packages/shop";

//env
const PORT = Number(Deno.env.get("PORT"));

const handler = io.handler();

//serve websockets to client -- must be on HTTP1.1 / ws://
Deno.serve({ port: PORT }, (req, info) => {
  return handler(req, {
    localAddr: { transport: "tcp", hostname: "0.0.0.0", port: PORT },
    remoteAddr: info.remoteAddr,
  });
});
