//TODO
import { Listeners, WebSocketCtx, type Emitters } from "@packages/websockets";
import z from "zod";

const MMREmitters = {
  "score:get": z.number(),
} as const satisfies Emitters;

export const ctx = new WebSocketCtx({} as Listeners, MMREmitters);
