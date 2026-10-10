import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { api } from "./api";
import { Modal, Notice, useAction } from "./components";
import { t } from "./i18n";

export function DeleteProject({
  id,
  name,
  onDeleted,
}: {
  id: string;
  name: string;
  onDeleted: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const action = useAction();
  return (
    <>
      <button
        className="icon-button danger-text"
        title={t("删除项目")}
        aria-label={`${t("删除项目")} ${name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 size={18} />
      </button>
      {open && (
        <Modal
          title={t("移入回收站")}
          onClose={() => {
            if (!action.busy) setOpen(false);
          }}
        >
          <p>
            <strong>{name}</strong>
          </p>
          <p>
            {t(
              "运行中的应用会停止，开发任务会取消。项目文件、配置和应用数据将保留，可从回收站恢复。",
            )}
          </p>
          {action.error && <Notice>{action.error}</Notice>}
          <div className="form-actions">
            <button disabled={action.busy} onClick={() => setOpen(false)}>
              {t("取消")}
            </button>
            <button
              className="danger"
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await api(`/api/projects/${id}`, { method: "DELETE" });
                  setOpen(false);
                  await onDeleted();
                })
              }
            >
              <Trash2 size={16} />
              {action.busy ? t("正在删除…") : t("确认删除")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function ExportProject({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const action = useAction();
  return (
    <>
      <button onClick={() => setOpen(true)}>
        <Download size={16} />
        {t("导出应用")}
      </button>
      {open && (
        <Modal title={t("导出到本地或云服务器")} onClose={() => setOpen(false)}>
          <p>
            {t(
              "下载独立运行包，包含应用配置、共享模块、项目源码和云部署配置。应用数据、账户和密钥不会导出。",
            )}
          </p>
          <p>
            {t(
              "本地启动使用 Node.js 24；云部署使用 Docker Compose。自定义代码需单独构建与审核，导出包不会自动执行。",
            )}
          </p>
          {action.error && <Notice>{action.error}</Notice>}
          <button
            className="primary"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                const response = await fetch(`/api/projects/${id}/export`, {
                  credentials: "same-origin",
                });
                if (!response.ok)
                  throw new Error((await response.json()).message);
                const url = URL.createObjectURL(await response.blob());
                const link = document.createElement("a");
                link.href = url;
                link.download = `atlas-${id}.zip`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              })
            }
          >
            <Download size={16} />
            {action.busy ? t("正在打包…") : t("下载 ZIP")}
          </button>
        </Modal>
      )}
    </>
  );
}
