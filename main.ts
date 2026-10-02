
//env
const PORT = Number(Deno.env.get("PORT"));


//serve websockets to client -- must be on HTTP1.1 / ws:// through caddy
Deno.serve({port: PORT}, (req) => {
  if(req.headers.get("upgrade") !== "websocket") {
    return new Response(null, {status: 501})
  }

  const {socket, response} = Deno.upgradeWebSocket(req)

  socket.addEventListener("open", () => {
    console.log("[Darts 2' Million] :: A client has connected");
  })

  socket.addEventListener("close", () => {
    console.log("[Darts 2' Million] :: A client has connected")
  })

  return response;
})