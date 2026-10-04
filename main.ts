import { io } from "@packages/websockets";
import { matchContext } from "@packages/mmr";

//env
const PORT = Number(Deno.env.get("PORT"));

const handler = io.handler();

//serve websockets to client -- must be on HTTP1.1 / ws://
Deno.serve({ port: PORT }, (req, info) =>
  handler(req, {
    localAddr: { transport: "tcp", hostname: "0.0.0.0", port: PORT },
    remoteAddr: info.remoteAddr,
  }),
);
