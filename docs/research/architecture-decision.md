# Architecture decision from research

The sampled ecosystem spans Spring/MySQL, Django/PostgreSQL, React, Flutter and WeChat mini-programs. Direct code assembly would couple unrelated identity, database and permission models. Reuse contracts and mature infrastructure libraries instead of copying course projects or unlicensed source.

Choose TypeScript, React/Vite, Fastify, Zod, PostgreSQL semantics, a durable SQL job/event log, and an explicit registry. This avoids a framework-specific module UI dependency while keeping API and manifest types shared. A modular monolith controls apps; applications run in separate processes locally or isolated Docker environments when available. PGlite supplies actual PostgreSQL in Windows local development; pg supplies server PostgreSQL compatibility, which still requires integration validation.

Version compatibility is enforced by semver and a lock per application. No message broker is necessary for the initial single-worker queue. Jobs interrupted by restart are surfaced explicitly; queued jobs resume. Docker is mandatory for generated executable code. The packaged local runtime is trusted first-party source and is not a hostile-code sandbox.

The concrete system model, execution constraints and deferred production requirements are in ../../ARCHITECTURE.md.
