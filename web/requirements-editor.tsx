import { Plus, Trash2, Users, Database, ListChecks } from "lucide-react";
import type { ProductRequirements } from "../packages/contracts/src/requirements";
import { t } from "./i18n";
import "./requirements.css";

export const emptyRequirements: ProductRequirements = {
  roles: [],
  models: [],
  scenarios: [],
};
const newId = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
export function RequirementsEditor({
  value,
  onChange,
  modules,
}: {
  value: ProductRequirements;
  onChange: (value: ProductRequirements) => void;
  modules: string[];
}) {
  function role(
    index: number,
    patch: Partial<ProductRequirements["roles"][number]>,
  ) {
    onChange({
      ...value,
      roles: value.roles.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    });
  }
  function model(
    index: number,
    patch: Partial<ProductRequirements["models"][number]>,
  ) {
    onChange({
      ...value,
      models: value.models.map((m, i) =>
        i === index ? { ...m, ...patch } : m,
      ),
    });
  }
  function scenario(
    index: number,
    patch: Partial<ProductRequirements["scenarios"][number]>,
  ) {
    onChange({
      ...value,
      scenarios: value.scenarios.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    });
  }
  return (
    <div className="requirements-editor">
      <section className="requirements-section">
        <div className="section-head">
          <h3>
            <Users size={18} />
            {t("用户角色")}
            <span className="requirement-count">{value.roles.length}</span>
          </h3>
          <button
            type="button"
            disabled={value.roles.length >= 20}
            onClick={() =>
              onChange({
                ...value,
                roles: [
                  ...value.roles,
                  { id: newId("role"), name: "", responsibility: "" },
                ],
              })
            }
          >
            <Plus size={16} />
            {t("添加角色")}
          </button>
        </div>
        <div className="requirement-items role-items">
          {!value.roles.length && (
            <p className="requirements-empty">{t("暂无用户角色")}</p>
          )}
          {value.roles.map((r, i) => (
            <fieldset key={r.id}>
              <legend>
                {t("角色")} {i + 1}
              </legend>
              <label>
                {t("角色名称")}
                <input
                  required
                  maxLength={80}
                  value={r.name}
                  onChange={(e) => role(i, { name: e.target.value })}
                />
              </label>
              <label>
                {t("职责与权限")}
                <textarea
                  required
                  maxLength={600}
                  rows={2}
                  value={r.responsibility}
                  onChange={(e) => role(i, { responsibility: e.target.value })}
                />
              </label>
              <button
                type="button"
                aria-label={t("删除角色")}
                disabled={value.scenarios.some((s) => s.roleId === r.id)}
                title={t("先移除关联场景，再删除角色")}
                onClick={() =>
                  onChange({
                    ...value,
                    roles: value.roles.filter((_, n) => n !== i),
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            </fieldset>
          ))}
        </div>
      </section>
      <section className="requirements-section">
        <div className="section-head">
          <h3>
            <Database size={18} />
            {t("数据模型")}
            <span className="requirement-count">{value.models.length}</span>
          </h3>
          <button
            type="button"
            disabled={value.models.length >= 30}
            onClick={() =>
              onChange({
                ...value,
                models: [
                  ...value.models,
                  {
                    id: newId("model"),
                    name: "",
                    fields: [{ name: "title", type: "text", required: true }],
                  },
                ],
              })
            }
          >
            <Plus size={16} />
            {t("添加模型")}
          </button>
        </div>
        <div className="requirement-items">
          {!value.models.length && (
            <p className="requirements-empty">{t("暂无数据模型")}</p>
          )}
          {value.models.map((m, i) => (
            <fieldset key={m.id}>
              <legend>
                {t("模型")} {i + 1}
              </legend>
              <label>
                {t("模型名称")}
                <input
                  required
                  maxLength={80}
                  value={m.name}
                  onChange={(e) => model(i, { name: e.target.value })}
                />
              </label>
              {m.fields.map((f, j) => (
                <div className="requirement-field" key={j}>
                  <label>
                    {t("字段名")}
                    <input
                      required
                      pattern="[a-z][a-zA-Z0-9_-]{0,63}"
                      value={f.name}
                      onChange={(e) =>
                        model(i, {
                          fields: m.fields.map((x, n) =>
                            n === j ? { ...x, name: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    {t("字段类型")}
                    <select
                      value={f.type}
                      onChange={(e) =>
                        model(i, {
                          fields: m.fields.map((x, n) =>
                            n === j
                              ? {
                                  ...x,
                                  type: e.target.value as typeof f.type,
                                  references: undefined,
                                }
                              : x,
                          ),
                        })
                      }
                    >
                      <option value="text">{t("文本")}</option>
                      <option value="number">{t("数字")}</option>
                      <option value="boolean">{t("布尔值")}</option>
                      <option value="date">{t("日期")}</option>
                      <option value="reference">{t("关联模型")}</option>
                    </select>
                  </label>
                  {f.type === "reference" && (
                    <label>
                      {t("关联目标")}
                      <select
                        required
                        value={f.references ?? ""}
                        onChange={(e) =>
                          model(i, {
                            fields: m.fields.map((x, n) =>
                              n === j
                                ? { ...x, references: e.target.value }
                                : x,
                            ),
                          })
                        }
                      >
                        <option value="">{t("请选择")}</option>
                        {value.models.map((target) => (
                          <option key={target.id} value={target.id}>
                            {target.name || target.id}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="requirement-check">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) =>
                        model(i, {
                          fields: m.fields.map((x, n) =>
                            n === j ? { ...x, required: e.target.checked } : x,
                          ),
                        })
                      }
                    />
                    {t("必填")}
                  </label>
                  <button
                    type="button"
                    aria-label={t("删除字段")}
                    disabled={m.fields.length <= 1}
                    onClick={() =>
                      model(i, { fields: m.fields.filter((_, n) => n !== j) })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <div className="inline-actions">
                <button
                  type="button"
                  disabled={m.fields.length >= 40}
                  onClick={() =>
                    model(i, {
                      fields: [
                        ...m.fields,
                        {
                          name: `field${m.fields.length + 1}`,
                          type: "text",
                          required: false,
                        },
                      ],
                    })
                  }
                >
                  <Plus size={16} />
                  {t("添加字段")}
                </button>
                <button
                  type="button"
                  disabled={value.models.some(
                    (x) =>
                      x.id !== m.id &&
                      x.fields.some((f) => f.references === m.id),
                  )}
                  onClick={() =>
                    onChange({
                      ...value,
                      models: value.models.filter((_, n) => n !== i),
                    })
                  }
                >
                  <Trash2 size={16} />
                  {t("删除模型")}
                </button>
              </div>
            </fieldset>
          ))}
        </div>
      </section>
      <section className="requirements-section">
        <div className="section-head">
          <h3>
            <ListChecks size={18} />
            {t("验收场景")}
            <span className="requirement-count">{value.scenarios.length}</span>
          </h3>
          <button
            type="button"
            disabled={!value.roles.length || value.scenarios.length >= 60}
            onClick={() =>
              onChange({
                ...value,
                scenarios: [
                  ...value.scenarios,
                  {
                    id: newId("scenario"),
                    title: "",
                    roleId: value.roles[0].id,
                    given: "",
                    when: "",
                    then: "",
                    moduleIds: [],
                  },
                ],
              })
            }
          >
            <Plus size={16} />
            {t("添加场景")}
          </button>
        </div>
        <div className="requirement-items scenario-items">
          {!value.scenarios.length && (
            <p className="requirements-empty">{t("暂无验收场景")}</p>
          )}
          {value.scenarios.map((s, i) => (
            <fieldset key={s.id}>
              <legend>
                {t("场景")} {i + 1} · {t("未运行")}
              </legend>
              <label>
                {t("场景名称")}
                <input
                  required
                  maxLength={160}
                  value={s.title}
                  onChange={(e) => scenario(i, { title: e.target.value })}
                />
              </label>
              <label>
                {t("参与角色")}
                <select
                  value={s.roleId}
                  onChange={(e) => scenario(i, { roleId: e.target.value })}
                >
                  {value.roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || r.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("前置条件")}
                <textarea
                  required
                  maxLength={1000}
                  rows={2}
                  value={s.given}
                  onChange={(e) => scenario(i, { given: e.target.value })}
                />
              </label>
              <label>
                {t("用户操作")}
                <textarea
                  required
                  maxLength={1000}
                  rows={2}
                  value={s.when}
                  onChange={(e) => scenario(i, { when: e.target.value })}
                />
              </label>
              <label>
                {t("预期结果")}
                <textarea
                  required
                  maxLength={1000}
                  rows={2}
                  value={s.then}
                  onChange={(e) => scenario(i, { then: e.target.value })}
                />
              </label>
              <div
                className="requirement-modules"
                role="group"
                aria-label={t("关联模块")}
              >
                <span>{t("关联模块")}</span>
                <div>
                  {modules.map((id) => (
                    <label key={id}>
                      <input
                        type="checkbox"
                        checked={s.moduleIds.includes(id)}
                        onChange={(e) =>
                          scenario(i, {
                            moduleIds: e.target.checked
                              ? [...s.moduleIds, id]
                              : s.moduleIds.filter((value) => value !== id),
                          })
                        }
                      />
                      {id}
                    </label>
                  ))}
                </div>
              </div>
              <button
                type="button"
                aria-label={t("删除场景")}
                onClick={() =>
                  onChange({
                    ...value,
                    scenarios: value.scenarios.filter((_, n) => n !== i),
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            </fieldset>
          ))}
        </div>
      </section>
    </div>
  );
}
