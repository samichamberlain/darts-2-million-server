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
  const members = lobbies.get(room);

  //set empty set to room id -- new lobby
  if (!members) lobbies.set(room, new Set());

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

  //Test -- remove later
  socket.emit("connected");

  //apply handlers to the socket
  for (const [event, handlers] of onHandlerRegistry) {
    for (const handler of handlers) {
      bindCallbacks(socket as ServerSocket, event, handler);
    }
  }

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    const id = getRoomOfSocket(socket as ServerSocket);
    socketLeaveLobby(socket as ServerSocket);
  });
});

export type WebSocketCallbacks = Record<string, z.ZodType>;

export class WebSocketCtx<
  //Types must be an object of keys + payload type. Emit and on typings are separate.
  TListen,
  TEmit,
> {
  public io: Server = instance;

  //zod schema inference for emit and on callbacks
  constructor(_listenCallbacks: TListen, _emitCallbacks: TEmit) {}

  on<K extends keyof TListen & string>(
    event: K,
    handler: OnHandler<z.infer<TListen[K]>>,
  ) {
    //cache for future conns.
    onHandlerRegistry.set(event, [
      ...(onHandlerRegistry.get(event) ?? []),
      handler,
    ]);

    // bind all sockets to the new handler
    const sockets = (Object.values(lobbies) as ServerSocket[][]).flatMap(
      (s) => s,
    );

    for (const socket of sockets) {
      bindCallbacks(socket, event, handler);
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

//on callback handling cache
type OnHandler<TOnArgs> = (
  socket: ServerSocket,
  payload: TOnArgs,
  room: string,
) => void | Promise<void>;
const onHandlerRegistry = new Map<string, OnHandler<any>[]>();

//Bind client callback handlers
function bindCallbacks(
  socket: ServerSocket,
  event: string,
  handler: OnHandler<any>,
) {
  socket.on(event, (payload: unknown) =>
    handler(socket, payload, getRoomOfSocket(socket) as string),
  );
}
