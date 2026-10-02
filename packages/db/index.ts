import { Prisma, PrismaClient } from "./generated/prisma/client.ts";
import {PrismaPg} from "@prisma/adapter-pg"

const adapter = new PrismaPg({
    connectionString: Deno.env.get("DATABASE_URL")!
})

const prisma = new PrismaClient({adapter});


// Example transaction schema
// runTransaction((tx) => {
//     return tx.user.create({
//         data: {
//             id: "3043420i9",
//             mmr: 1
//         }
//     })
// })

export async function runTransaction<T>(op: (tx: Prisma.TransactionClient) => Promise<T>, 
    options?: {   maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel} ) {
        try {
            return await prisma.$transaction(async (tx) => {
                return await op(tx)
            }, options)
        }
        catch(err) {
            console.error(`[Transaction Manager] :: Transaction failed -- Rolled back: ${err}`)
        }
    }
