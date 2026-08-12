import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient()
}

declare global {
  var basePrisma: undefined | ReturnType<typeof prismaClientSingleton>
}

export const basePrisma = globalThis.basePrisma ?? prismaClientSingleton()
if (process.env.NODE_ENV !== 'production') globalThis.basePrisma = basePrisma

const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const excludedModels = ['Organization', 'Account', 'Session', 'VerificationToken', 'PasswordResetToken', 'ChatParticipant', 'ChatMessage'];
        if (excludedModels.includes(model)) {
          return query(args);
        }

        let orgId: string | undefined = undefined;
        try {
          const { auth } = await import('@/auth');
          const session = await auth();
          orgId = session?.user?.orgId;
        } catch (e) {
          // auth() might fail if called outside a Next.js request context (e.g. background job, CLI)
        }

        if (orgId) {
          // Add orgId to where clause for read/update/delete operations
          if (['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'update', 'updateMany', 'delete', 'deleteMany', 'aggregate', 'groupBy'].includes(operation)) {
            // @ts-ignore
            args.where = { ...(args.where || {}), orgId };
          }
          
          // Add orgId to create operations
          if (['create', 'createMany', 'upsert'].includes(operation)) {
            if (operation === 'create') {
              // @ts-ignore
              args.data = { ...args.data, orgId };
            } else if (operation === 'upsert') {
              // @ts-ignore
              if (args.create) args.create = { ...args.create, orgId };
              // @ts-ignore
              if (args.update) args.update = { ...args.update, orgId };
            } else if (operation === 'createMany') {
              // @ts-ignore
              args.data = Array.isArray(args.data) 
                ? args.data.map((d: any) => ({ ...d, orgId })) 
                : { ...(args.data as any), orgId };
            }
          }
        }
        
        return query(args);
      }
    }
  }
});

// Since the extension changes the type slightly, we just export it as default
export default prisma;

