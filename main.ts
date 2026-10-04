import { io } from "@packages/websockets";
import { matchContext as _matchContext } from "@packages/mmr";

//env
const PORT = Number(Deno.env.get("PORT"));

const handler = io.handler();

//serve websockets to client -- must be on HTTP1.1 / ws://
Deno.serve({ port: PORT }, async (req, info) => {
  const landing = await Deno.readTextFile("public/index.html");
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response(landing, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }

  return handler(req, {
    localAddr: { transport: "tcp", hostname: "0.0.0.0", port: PORT },
    remoteAddr: info.remoteAddr,
  });
});
