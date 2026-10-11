import { Prisma, PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: Deno.env.get("DATABASE_URL")!,
});

const prisma = new PrismaClient({ adapter });

//expose prisma transaction typing to other packages
export type TransactionClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export async function runTransaction<T>(
  op: (tx: TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  },
): Promise<T | undefined> {
  try {
    return await prisma.$transaction(op, options);
  } catch (err) {
    console.error(
      `[Transaction Manager] :: Transaction failed -- Rolled back: ${err}`,
    );
  }
}
