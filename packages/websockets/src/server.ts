import { Server, Socket } from "socket_io";
import z from "zod";

interface SocketMetadata {
  lobbyId?: string;
  isReady: boolean;
}

//Attach lobby id to socket for ease of access.
// deno-lint-ignore no-explicit-any
type ServerSocket = Socket<any, any, any, SocketMetadata>;

//Lobbies + Queue
let queue: ServerSocket[] = [];
let lobbyIter: number = 0;
const MAX_PLAYERS_PER_LOBBY: number = 2;

const lobbies: Map<string, Set<ServerSocket>> = new Map<
  string,
  Set<ServerSocket>
>();

function emitLobbyListeners(listeners: LobbyEvent[], lobbyId: string) {
  for (const listener of listeners) {
    listener(lobbyId);
  }
}

export const instance: Server = new Server({
  path: Deno.env.get("WEBSOCKET_PATH"),
  cors: {
    origin: "*", //TODO: change this to itch's domain once we ahve that set up correctly.
  },
});

function generateLobbyCode(id: number) {
  const code = id.toString(36).padStart(5, "0").toUpperCase();
  lobbyIter++;
  return code;
}

function getRoomOfSocket(socket: ServerSocket): string | undefined {
  return socket.data.lobbyId;
}

export type Emitters = Record<string, z.ZodType>;
export type Listeners = Record<string, { req?: z.ZodType; res?: z.ZodType }>;

type LobbyEvent = (lobbyId: string) => void;

export class WebSocketCtx<
  //Types must be an object of keys + payload type. Emit and on typings are separate.
  TListen extends Listeners,
  TEmit extends Emitters,
> {
  public io: Server = instance;

  private lobbyCreateListeners: LobbyEvent[] = [];
  private lobbyDeleteListeners: LobbyEvent[] = [];
  private lobbyReadyListeners: LobbyEvent[] = [];

  private socketLeaveQueue(socket: ServerSocket) {
    if (queue.includes(socket)) {
      const idx = queue.indexOf(socket);
      queue.splice(idx, 1);

      console.log(`${socket.id} left the queue. Queue length: ${queue.length}`);
    }
  }

  private socketLeaveLobby(socket: ServerSocket) {
    const lobbyId = socket.data.lobbyId;

    if (!lobbyId) return;

    socket.leave(lobbyId);
    socket.data.lobbyId = undefined;

    const members = lobbies.get(lobbyId);
    members?.delete(socket);

    if (members?.size === 0) {
      lobbies.delete(lobbyId);
      emitLobbyListeners(this.lobbyDeleteListeners, lobbyId);
      console.log(`Lobby ${lobbyId} deleted.`);
    }
  }

  private onHandlerRegistry = new Map<string, RegistryEntry[]>();

  //zod schema inference for emit and on callbacks
  constructor(
    private listeners: TListen,
    _emitCallbacks?: TEmit,
  ) {
    instance.on("connection", (socket) => {
      console.log(`Client connected: ${socket.id}`);

      //apply handlers to the socket
      for (const [event, handlers] of this.onHandlerRegistry) {
        for (const handler of handlers) {
          bindCallbacks(socket as ServerSocket, event, handler);
        }
      }

      socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.socketLeaveQueue(socket as ServerSocket);
        this.socketLeaveLobby(socket as ServerSocket);
      });
    });
  }

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
    this.onHandlerRegistry.set(event, [
      ...(this.onHandlerRegistry.get(event) ?? []),
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

  joinQueue(socket: ServerSocket) {
    if (socket.data.lobbyId) {
      console.log("Socket is already in lobby... Aborting.");
      return;
    }

    queue.push(socket);

    //Get rid of the chance of having a duplicate queue entry, or any that are null/undefined.
    queue = Array.from(
      new Set(queue.filter((q) => q !== undefined && q !== null)),
    );

    console.log(
      `[Match] :: ${socket.id} joined the matchmaking queue. Queue length: ${queue.length}`,
    );

    if (queue.length >= MAX_PLAYERS_PER_LOBBY) {
      const lobbyId = generateLobbyCode(lobbyIter);

      console.log(`Creating lobby ${lobbyId}.`);
      const players_in_lobby: Set<ServerSocket> = new Set<ServerSocket>();

      for (let i = 0; i < MAX_PLAYERS_PER_LOBBY; i++) {
        const socket = queue.shift() as ServerSocket;
        socket.data.lobbyId = lobbyId;
        socket.data.isReady = false;
        socket?.join(lobbyId);
        players_in_lobby.add(socket);
      }

      console.log(
        `Lobby ${lobbyId} created. Players in lobby: ${players_in_lobby}`,
      );

      lobbies.set(lobbyId, players_in_lobby);
      emitLobbyListeners(this.lobbyCreateListeners, lobbyId);
    }
  }

  leaveQueue(socket: ServerSocket) {
    this.socketLeaveQueue(socket);
  }

  onLobbyCreate(callback: (lobbyId: string) => void) {
    this.lobbyCreateListeners.push(callback);
  }

  onLobbyDelete(callback: (lobbyId: string) => void) {
    this.lobbyDeleteListeners.push(callback);
  }

  onLobbyReady(callback: (lobbyId: string) => void) {
    this.lobbyReadyListeners.push(callback);
  }

  leaveLobby(socket: ServerSocket) {
    this.socketLeaveLobby(socket);
    socket.data.isReady = false;
  }

  clientsInLobby(lobbyId: string) {
    return lobbies.get(lobbyId);
  }

  lobbyOfClient(socket: ServerSocket) {
    const lobbyIds = socket.rooms;
  }

  readyClient(socket: ServerSocket) {
    const lobby = lobbies.get(socket.data.lobbyId ?? "");
    if (!lobby) {
      console.error("Cannot ready client. They are not in a lobby.");
      return;
    }

    socket.data.isReady = true;

    const allReady = [...lobby].every((s) => s.data.isReady);

    if (allReady)
      emitLobbyListeners(
        this.lobbyReadyListeners,
        socket.data.lobbyId as string,
      );
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
    if (!parsed.success) {
      console.error(`Failed to validate zod input for ${event}: `, payload);

      return ack?.({
        error: "Entered invalid data for websocket callback",
      });
    }

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
