mkdir -p src/{config,modules,middleware,utils,database}
mkdir -p src/modules/{auth,users,accounts,transactions,ledger,notifications,admin}
mkdir -p prisma
mkdir -p tests

touch src/app.ts
touch src/server.ts

# config
touch src/config/{database.ts,redis.ts,env.ts}

# middleware
touch src/middleware/{auth.middleware.ts,rateLimiter.ts,errorHandler.ts}

# utils
touch src/utils/{logger.ts,generateAccountNumber.ts,idempotency.ts}

# modules auth
touch src/modules/auth/{auth.controller.ts,auth.service.ts,auth.routes.ts,auth.types.ts}

# users
touch src/modules/users/{user.controller.ts,user.service.ts,user.repository.ts,user.types.ts}

# accounts
touch src/modules/accounts/{account.controller.ts,account.service.ts,account.repository.ts,account.types.ts}

# transactions
touch src/modules/transactions/{transaction.controller.ts,transaction.service.ts,transaction.repository.ts,transaction.types.ts}

# ledger
touch src/modules/ledger/{ledger.service.ts,ledger.repository.ts}

# notifications
touch src/modules/notifications/{notification.service.ts,email.provider.ts}

# admin
touch src/modules/admin/{admin.controller.ts,admin.service.ts}

# database
touch src/database/seed.ts

# prisma
touch prisma/schema.prisma