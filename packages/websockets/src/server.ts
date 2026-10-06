import { Server, Socket } from "socket_io";
import z from "zod";

interface SocketMetadata {
  lobbyId?: string;
  isReady: boolean;
}

//Attach lobby id to socket for ease of access.
// deno-lint-ignore no-explicit-any
type ServerSocket = Socket<any, any, any, SocketMetadata>;

let lobbyIter: number = 0;

const MAX_PLAYERS_PER_ROOM: number = 2;

export const instance: Server = new Server({
  path: "/darts-2-million/",
  cors: {
    origin: "*", //TODO: change this to itch's domain once we ahve that set up correctly.
  },
});

const lobbies: Map<string, Set<ServerSocket>> = new Map<
  string,
  Set<ServerSocket>
>();

function generateLobbyCode(id: number) {
  const code = id.toString(36).padStart(5, "0").toUpperCase();
  lobbyIter++;
  return code;
}

function getRoomOfSocket(socket: ServerSocket): string | undefined {
  return socket.data.lobbyId;
}

function socketJoinLobby(socket: ServerSocket, room: string) {
  socket.join(room);
  let members = lobbies.get(room);

  //set empty set to room id -- new lobby
  if (!members) {
    members = new Set();
    lobbies.set(room, members);
  }

  members?.add(socket);
  socket.data.lobbyId = room;
}

function socketLeaveLobby(socket: ServerSocket) {
  const lobbyId = socket.data.lobbyId;

  if (!lobbyId) return;

  socket.leave(lobbyId);
  socket.data.lobbyId = undefined;

  const members = lobbies.get(lobbyId);
  members?.delete(socket);

  if (members?.size === 0) lobbies.delete(lobbyId);
}

function getRoomById(roomId: string) {
  return instance.of("/").adapter.socketRooms(roomId);
}

instance.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);
  console.log("registered events:", [...onHandlerRegistry.keys()]);

  //apply handlers to the socket
  for (const [event, handlers] of onHandlerRegistry) {
    for (const handler of handlers) {
      bindCallbacks(socket as ServerSocket, event, handler);
    }
  }

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    socketLeaveLobby(socket as ServerSocket);
  });
});
type Listener = { req?: z.ZodType; res?: z.ZodType };

export type Emitters = Record<string, z.ZodType>;
export type Listeners = Record<string, Listener>;

export class WebSocketCtx<
  //Types must be an object of keys + payload type. Emit and on typings are separate.
  TListen extends Listeners,
  TEmit extends Emitters,
> {
  public io: Server = instance;

  //zod schema inference for emit and on callbacks
  constructor(
    private listeners: TListen,
    _emitCallbacks?: TEmit,
  ) {}

  on<K extends keyof TListen & string>(
    event: K,
    handler: OnHandler<
      //request zod type
      z.infer<TListen[K]["req"]>,
      //resposne zod type -- void if no response is defined.
      TListen[K]["res"] extends z.ZodType ? z.infer<TListen[K]["res"]> : void
    >,
  ) {
    const entry: RegistryEntry = {
      request: this.listeners[event].req,
      handler,
    };
    //cache for future conns.
    onHandlerRegistry.set(event, [
      ...(onHandlerRegistry.get(event) ?? []),
      entry,
    ]);

    // bind all sockets to the new handler
    const sockets = (Object.values(lobbies) as ServerSocket[][]).flatMap(
      (s) => s,
    );

    for (const socket of sockets) {
      bindCallbacks(socket, event, entry);
    }

    //curry fn
    return this;
  }

  isLobbyFull(socket: ServerSocket) {
    const roomId = getRoomOfSocket(socket);
    return (
      !!roomId && (getRoomById(roomId)?.size ?? 0) === MAX_PLAYERS_PER_ROOM
    );
  }

  roomQueue(socket: ServerSocket) {
    const open = [...lobbies].find(
      ([_id, lobby]) => lobby.size < MAX_PLAYERS_PER_ROOM,
    );

    const code = open?.[0] ?? this.createLobby();
    socketJoinLobby(socket, code);

    return code;
  }

  createLobby() {
    return generateLobbyCode(lobbyIter);
  }

  leaveLobby(socket: ServerSocket) {
    socketLeaveLobby(socket);
  }

  clientsInLobby(lobbyId: string) {
    return lobbies.get(lobbyId);
  }

  allClientsReady(lobbyId: string) {
    const sockets = lobbies.get(lobbyId);
    if (!sockets) return false;

    return [...sockets].every((s) => s.data.isReady);
  }

  emit<K extends keyof TEmit>(
    event: K,
    payload: z.infer<TEmit[K]>,
    to?: string | string[],
  ) {
    if (to) this.io.to(to).emit(event as string, payload);
    else this.io.emit(event as string, payload);
    //curry fn
    return this;
  }
}

export type SocketCommandCallback<TArgs, TReturn> = {
  id: string;
  cb: (args: TArgs) => TReturn;
};

//listener acknowledge callback handling cache
type OnHandler<TReq, TRes = void> = (
  socket: ServerSocket,
  payload: TReq,
  room: string,
) => TRes | Promise<TRes>;

type RegistryEntry = {
  request: z.ZodType | undefined;
  handler: OnHandler<any, any>;
};

type Ack = (res: unknown) => void;

const onHandlerRegistry = new Map<string, RegistryEntry[]>();

//Bind client callback handlers
function bindCallbacks(
  socket: ServerSocket,
  event: string,
  { request, handler }: RegistryEntry,
) {
  socket.on(event, async (payload: unknown, ack?: Ack) => {
    const parsed = request
      ? request.safeParse(payload)
      : //Request is optional... we pass and send no data if no request is passed.
        { success: true, data: undefined };

    //validate that the correct data types are being passed through.
    if (!parsed.success)
      return ack?.({
        error: "Entered invalid data for websocket callback",
      });

    try {
      const result = await handler(
        socket,
        parsed.data,
        getRoomOfSocket(socket) as string,
      );
      ack?.(result);
    } catch (err) {
      console.error(`Handler for "${event}" failed`, err);
      ack?.({ error: "Internal error" });
    }
  });
}
