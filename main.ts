import { io } from "@packages/websockets";
import {
  matchContext as _matchContext,
  mmrContext as _mmrContext,
} from "@packages/mmr";
import { authContext as _authContext } from "@packages/auth";

//env
const PORT = Number(Deno.env.get("PORT"));

const handler = io.handler();

console.log(Deno.env.get("PORT"));

//serve websockets to client -- must be on HTTP1.1 / ws://
Deno.serve({ port: PORT }, (req, info) => {
  return handler(req, {
    localAddr: { transport: "tcp", hostname: "0.0.0.0", port: PORT },
    remoteAddr: info.remoteAddr,
  });
});
