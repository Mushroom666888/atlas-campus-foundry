import { useState, type ReactNode, type FormEvent } from "react";
import {
  Boxes,
  LogIn,
  ArrowRight,
  X,
  LoaderCircle,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { post } from "./api";
import type { PublicUser } from "../packages/contracts/src/index";
export function Notice({
  children,
  kind = "error",
}: {
  children: ReactNode;
  kind?: "error" | "info" | "success";
}) {
  return (
    <div
      className={`notice ${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <AlertCircle size={17} />
      <span>{children}</span>
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Inbox size={28} />
      <p>{children}</p>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={22} />
      正在加载
    </div>
  );
}
export function Badge({ status }: { status: string }) {
  const names: Record<string, string> = {
    running: "运行中",
    succeeded: "已通过",
    failed: "失败",
    blocked: "等待配置",
    queued: "排队中",
    starting: "启动中",
    building: "构建中",
    stopped: "已停止",
    deleted: "已移除",
    interrupted: "已中断",
    needs_attention: "需要处理",
    cancelled: "已取消",
    approved: "已审核",
    pending: "待审核",
    platform: "内置",
    active: "有效",
    waiting: "候补中",
    joined: "已报名",
    sold: "已售出",
    closed: "已关闭",
  };
  return <span className={`badge ${status}`}>{names[status] ?? status}</span>;
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-head">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="关闭"
            title="关闭"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Auth({
  onUser,
  title = "Campus AI App Foundry",
  runtime = false,
}: {
  onUser: (user: PublicUser) => void;
  title?: string;
  runtime?: boolean;
}) {
  const [register, setRegister] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await post<{ user: PublicUser }>(
        `/api/auth/${register ? "register" : "login"}`,
        values,
      );
      onUser(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-brand">
        <Boxes size={32} />
        <span>{title}</span>
      </div>
      <section className="auth-form">
        <span className="eyebrow">
          {runtime ? "校园应用账户" : "DEVELOPER STUDIO"}
        </span>
        <h1>{register ? "创建账户" : "登录工作台"}</h1>
        <div className="tabs">
          <button
            className={!register ? "selected" : ""}
            onClick={() => {
              setRegister(false);
              setError("");
            }}
          >
            登录
          </button>
          <button
            className={register ? "selected" : ""}
            onClick={() => {
              setRegister(true);
              setError("");
            }}
          >
            注册
          </button>
        </div>
        {error && <Notice>{error}</Notice>}
        <form onSubmit={submit}>
          {register && (
            <label>
              称呼
              <input name="name" autoComplete="name" required maxLength={80} />
            </label>
          )}
          <label>
            邮箱
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            密码
            <input
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={10}
              maxLength={128}
              required
            />
          </label>
          <button className="primary full" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <LogIn size={18} />
            )}{" "}
            {register ? "注册并进入" : "登录"}
            <ArrowRight size={17} />
          </button>
        </form>
      </section>
      <p className="auth-footer">
        Campus AI App Foundry · {runtime ? "应用空间" : "校园产品开发工作台"}
      </p>
    </main>
  );
}
export function useAction() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function run(fn: () => Promise<unknown>, success = "") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      if (success) setMessage(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { error, busy, message, run, setError };
}
