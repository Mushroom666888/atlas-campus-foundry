import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, GitBranch, Sparkles, RefreshCw } from "lucide-react";
import { useLoad, post } from "./api";
import { Badge, Notice, useAction } from "./components";
import { ModuleMentionInput } from "./module-studio";
import { t } from "./i18n";
import type { ProductSpec } from "../packages/contracts/src/index";

type DesignJob = {
  id: string;
  input: string;
  mode: string;
  status: string;
  error?: string;
  plan?: ProductSpec;
  result?: { summary?: string };
};
export function VisualDesignStart() {
  const [params, setParams] = useSearchParams();
  const [idea, setIdea] = useState("");
  const action = useAction();
  const jobs = useLoad<{ items: DesignJob[] }>("/api/jobs", 5000);
  const selected = params.get("design");
  const detail = useLoad<{ job: DesignJob }>(
    selected ? `/api/jobs/${selected}` : null,
    2500,
  );
  const job = detail.data?.job;
  return (
    <div className="design-start">
      <span className="eyebrow">ATLAS CANVAS</span>
      <h1>{t("先说想法，再一起设计。")}</h1>
      <ol className="design-steps">
        <li>
          <span>01</span>
          {t("描述产品")}
        </li>
        <li>
          <span>02</span>
          {t("审阅可视化方案")}
        </li>
        <li>
          <span>03</span>
          {t("调整并生成应用")}
        </li>
      </ol>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void action.run(async () => {
            const result = await post<{ id: string }>("/api/jobs", {
              input: idea,
              mode: "design",
            });
            setParams({ design: result.id });
            await jobs.refresh();
          });
        }}
      >
        <label htmlFor="design-idea">{t("你想做一个什么产品？")}</label>
        <ModuleMentionInput
          name="idea"
          label={t("产品需求")}
          onChange={setIdea}
        />
        <div className="form-actions">
          <button
            className="primary"
            disabled={action.busy || idea.trim().length < 5}
          >
            <Sparkles size={18} />
            {action.busy ? t("正在提交…") : t("让 AI 设计方案")}
          </button>
          <Link className="button" to="/compose?mode=manual">
            <GitBranch size={18} />
            {t("手动选择模块")}
          </Link>
        </div>
      </form>
      {action.error && <Notice>{action.error}</Notice>}
      {detail.error && <Notice>{detail.error}</Notice>}
      {job && (
        <section className="design-job" aria-label={t("产品设计任务")}>
          <div className="section-head">
            <h2>{t("产品设计任务")}</h2>
            <Badge status={job.status} />
          </div>
          <p>{job.input}</p>
          {job.status === "blocked" && (
            <Notice kind="info">
              {t("模型尚未连接。需求已经保存，可在配置完成后重试。")}
            </Notice>
          )}
          {job.error && job.error !== "LLM_UNCONFIGURED" && (
            <Notice>{job.error}</Notice>
          )}
          {job.result?.summary && <p>{job.result.summary}</p>}
          {job.plan && (
            <>
              <h3>{job.plan.name}</h3>
              <p>{job.plan.description}</p>
              <ul>
                {job.plan.features.map((feature, i) => (
                  <li key={i}>{feature}</li>
                ))}
              </ul>
              <Link className="primary" to={`/compose?proposal=${job.id}`}>
                {t("审阅并调整方案")}
                <ArrowRight size={18} />
              </Link>
            </>
          )}
          {["blocked", "failed", "interrupted", "needs_attention"].includes(
            job.status,
          ) && (
            <button
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  const next = await post<{ id: string }>(
                    `/api/jobs/${job.id}/retry`,
                  );
                  setParams({ design: next.id });
                  await jobs.refresh();
                })
              }
            >
              <RefreshCw size={16} />
              {t("重试")}
            </button>
          )}
        </section>
      )}
      <section className="design-history">
        <h2>{t("已保存的设计需求")}</h2>
        {jobs.error && <Notice>{jobs.error}</Notice>}
        {jobs.data?.items
          .filter((item) => item.mode === "design")
          .map((item) => (
            <Link key={item.id} to={`/compose?design=${item.id}`}>
              <span>{item.input}</span>
              <Badge status={item.status} />
              <ArrowRight size={16} />
            </Link>
          ))}
      </section>
    </div>
  );
}
