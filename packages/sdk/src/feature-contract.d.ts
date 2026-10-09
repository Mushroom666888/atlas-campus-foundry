export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  verified: boolean;
}
export interface Request {
  body: unknown;
  params: Record<string, string>;
  query: Record<string, string>;
  user: User | null;
}
export interface Reply {
  code(status: number): Reply;
  send(value: unknown): unknown;
}
export interface Application {
  get(path: string, handler: (request: Request, reply: Reply) => unknown): void;
  post(
    path: string,
    handler: (request: Request, reply: Reply) => unknown,
  ): void;
  patch(
    path: string,
    handler: (request: Request, reply: Reply) => unknown,
  ): void;
  delete(
    path: string,
    handler: (request: Request, reply: Reply) => unknown,
  ): void;
}
export interface SQL {
  query<T = Record<string, unknown>>(
    sql: string,
    parameters?: unknown[],
  ): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
}
export interface FeatureContext {
  db: SQL & { transaction<T>(fn: (tx: SQL) => Promise<T>): Promise<T> };
  requireUser(request: Request): User;
  env: Record<string, string>;
  config: { appId: string };
}
