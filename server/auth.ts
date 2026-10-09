import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import {
  credentialsSchema,
  AppError,
  type PublicUser,
} from "../packages/contracts/src/index.js";
import type { Database } from "./db.js";

const scrypt = promisify(scryptCallback);
export const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${((await scrypt(password, salt, 64)) as Buffer).toString("hex")}`;
}
export async function checkPassword(password: string, value: string) {
  const [salt, hash] = value.split(":");
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  return (
    hash?.length === 128 && timingSafeEqual(actual, Buffer.from(hash, "hex"))
  );
}
type Account = PublicUser & { password_hash: string };
declare module "fastify" {
  interface FastifyRequest {
    user: PublicUser | null;
    sessionHash: string | null;
  }
}
export async function setupAuth(
  app: FastifyInstance,
  db: Database,
  scope: string,
  control: boolean,
) {
  const cookieName = `${process.env.COOKIE_SECURE === "true" ? "__Host-" : ""}foundry_${scope.replaceAll("-", "_")}`;
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    // Static bundles/fonts must not consume the shared API budget during navigation.
    allowList: (request) =>
      request.method === "GET" &&
      Boolean(request.routeOptions.url?.startsWith("/assets/")),
  });
  app.decorateRequest("user", null);
  app.decorateRequest("sessionHash", null);
  app.addHook("onRequest", async (request, reply) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "same-origin")
      .header("X-Frame-Options", "SAMEORIGIN");
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tile.openstreetmap.org; connect-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
    );
    const origin = request.headers.origin;
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && origin) {
      const expected =
        (control
          ? process.env.PUBLIC_ORIGIN
          : process.env.RUNTIME_PUBLIC_ORIGIN) ||
        `${request.protocol}://${request.headers.host}`;
      if (origin !== expected)
        throw new AppError(
          403,
          "ORIGIN_REJECTED",
          "Cross-origin mutation denied",
        );
    }
    const token = request.cookies[cookieName];
    request.sessionHash = token ? hashToken(token) : null;
    if (token)
      request.user =
        (
          await db.query<PublicUser>(
            "SELECT a.id,a.email,a.name,a.role,a.verified FROM accounts a JOIN sessions s ON s.user_id=a.id WHERE s.token_hash=$1 AND s.expires_at>now()",
            [hashToken(token)],
          )
        ).rows[0] ?? null;
  });
  async function session(reply: FastifyReply, user: PublicUser) {
    const token = randomBytes(32).toString("base64url");
    await db.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
      [hashToken(token), user.id],
    );
    reply.setCookie(cookieName, token, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 604800,
    });
    return { user };
  }
  app.post(
    "/api/auth/register",
    { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (control && process.env.ALLOW_REGISTRATION === "false")
        throw new AppError(
          403,
          "REGISTRATION_CLOSED",
          "Registration is closed",
        );
      const input = credentialsSchema.parse(request.body);
      const password = await hashPassword(input.password);
      const user = await db.transaction(async (tx) => {
        if (
          (
            await tx.query("SELECT id FROM accounts WHERE email=$1", [
              input.email,
            ])
          ).rows.length
        )
          throw new AppError(
            409,
            "EMAIL_EXISTS",
            "This email is already registered",
          );
        // A transaction serializes bootstrap admin creation in the embedded backend.
        if (control) await tx.query("SELECT pg_advisory_xact_lock(410019)");
        const first = !(await tx.query("SELECT id FROM accounts LIMIT 1")).rows
          .length;
        const value: PublicUser = {
          id: randomUUID(),
          email: input.email,
          name: input.name || input.email.split("@")[0],
          role: control && first ? "admin" : control ? "developer" : "member",
          verified: false,
        };
        await tx.query(
          "INSERT INTO accounts(id,email,name,password_hash,role) VALUES($1,$2,$3,$4,$5)",
          [value.id, value.email, value.name, password, value.role],
        );
        return value;
      });
      return session(reply.code(201), user);
    },
  );
  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: 15, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = credentialsSchema.parse(request.body);
      const user = (
        await db.query<Account>("SELECT * FROM accounts WHERE email=$1", [
          input.email,
        ])
      ).rows[0];
      if (!user || !(await checkPassword(input.password, user.password_hash)))
        throw new AppError(401, "INVALID_CREDENTIALS", "邮箱或密码不正确");
      return session(reply, {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        verified: user.verified,
      });
    },
  );
  app.get("/api/auth/me", async (request) => ({ user: request.user }));
  app.post("/api/auth/logout", async (request, reply) => {
    if (request.cookies[cookieName])
      await db.query("DELETE FROM sessions WHERE token_hash=$1", [
        hashToken(request.cookies[cookieName]!),
      ]);
    reply.clearCookie(cookieName, { path: "/" });
    return { ok: true };
  });
}
export function requireUser(request: FastifyRequest): PublicUser {
  if (!request.user) throw new AppError(401, "AUTH_REQUIRED", "请先登录");
  return request.user;
}
