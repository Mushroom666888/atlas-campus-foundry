import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../packages/contracts/src/index.js";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { existsSync } from "node:fs";

export function errors(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({
        code: "VALIDATION",
        message: "输入格式不正确",
        details: error.issues,
      });
    if (error instanceof AppError)
      return reply
        .code(error.status)
        .send({ code: error.code, message: error.message });
    const known = error as {
      statusCode?: number;
      code?: string;
      message?: string;
    };
    if (known.code === "23505")
      return reply.code(409).send({ code: "CONFLICT", message: "记录已存在" });
    if (known.statusCode && known.statusCode < 500)
      return reply
        .code(known.statusCode)
        .send({ code: known.code, message: known.message });
    request.log.error({ err: error }, "Request failed");
    return reply
      .code(500)
      .send({ code: "INTERNAL", message: "服务内部错误，请查看任务日志" });
  });
}
export async function serveFrontend(app: FastifyInstance) {
  const root = path.resolve("dist");
  if (existsSync(path.join(root, "index.html"))) {
    await app.register(fastifyStatic, { root, prefix: "/", wildcard: false });
    app.setNotFoundHandler((request, reply) =>
      request.url.startsWith("/api/")
        ? reply.code(404).send({ message: "API not found" })
        : reply.type("text/html").sendFile("index.html"),
    );
  } else
    app.get("/", async () => ({
      message: "Frontend not built. Run npm run build.",
      status: "API_READY",
    }));
}
