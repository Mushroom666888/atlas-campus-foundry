import { useState } from "react";
import { RotateCcw, History } from "lucide-react";
import { api, post, useLoad } from "./api";
import { Empty, Modal, Notice, useAction } from "./components";
import { localeTag, t } from "./i18n";

export function FileHistory({
  projectId,
  path,
  hash,
  onRestore,
  onClose,
  canRestore,
}: {
  projectId: string;
  path: string;
  hash: string | null;
  onRestore: (content: string, hash: string) => void;
  onClose: () => void;
  canRestore: boolean;
}) {
  const history = useLoad<{
    items: { revision: string; created_at: string; bytes: number }[];
  }>(
    `/api/projects/${projectId}/file-history?path=${encodeURIComponent(path)}`,
  );
  const action = useAction();
  const [selected, setSelected] = useState<{
    id: string;
    before: string | null;
    after: string;
  }>();
  return (
    <Modal title={t("文件历史")} onClose={onClose}>
      <p>
        <code>{path}</code>
      </p>
      {history.error && <Notice>{history.error}</Notice>}
      {action.error && <Notice>{action.error}</Notice>}
      {!history.loading && !history.data?.items.length && (
        <Empty>{t("暂无文件版本")}</Empty>
      )}
      <div className="file-history-list">
        {history.data?.items.map((item) => (
          <button
            key={item.revision}
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                const value = await api<{
                  before: string | null;
                  after: string;
                }>(`/api/projects/${projectId}/revisions/${item.revision}`);
                setSelected({ ...value, id: item.revision });
              })
            }
          >
            <History size={16} />
            <time>{new Date(item.created_at).toLocaleString(localeTag())}</time>
            <span>{item.bytes} B</span>
          </button>
        ))}
      </div>
      {selected && (
        <>
          <h3>{t("修改前")}</h3>
          <pre className="revision-source">
            {selected.before ?? t("新建文件")}
          </pre>
          <h3>{t("此版本内容")}</h3>
          <pre className="revision-source">{selected.after}</pre>
          <button
            disabled={action.busy || path === "product.json" || !canRestore}
            onClick={() =>
              void action.run(async () => {
                const result = await post<{ hash: string }>(
                  `/api/projects/${projectId}/revisions/${selected.id}/restore`,
                  { expectedHash: hash },
                );
                onRestore(selected.after, result.hash);
                onClose();
              })
            }
          >
            <RotateCcw size={16} />
            {t("恢复此版本")}
          </button>
        </>
      )}
    </Modal>
  );
}
