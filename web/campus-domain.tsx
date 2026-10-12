import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Save,
} from "lucide-react";
import {
  campusSchemas,
  type CampusCollection,
  type CampusRecord,
} from "../packages/contracts/src/campus";
import type { PublicUser } from "../packages/contracts/src/index";
import { api, useLoad } from "./api";
import { Empty, Loading, Modal, Notice, useAction } from "./components";
import { t } from "./i18n";
import "./campus-domain.css";

const titles: Record<CampusCollection, string> = {
  universities: "学校",
  campuses: "校区",
  buildings: "建筑",
  venues: "场地",
  courses: "课程",
  clubs: "社团",
};
type Page = {
  items: CampusRecord[];
  total: number;
  limit: number;
  offset: number;
};

function CampusPicker({
  collection,
  value,
  onChange,
  label,
  university = "",
  campus = "",
  required = false,
}: {
  collection: CampusCollection;
  value: string;
  onChange: (id: string) => void;
  label: string;
  university?: string;
  campus?: string;
  required?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const list = useLoad<Page>(
    `/api/campus/${collection}?limit=100&offset=${offset}&q=${encodeURIComponent(query)}${university ? `&universityId=${university}` : ""}${campus ? `&campusId=${campus}` : ""}`,
  );
  return (
    <div className="campus-picker">
      <label>
        {label}
        <select
          aria-label={label}
          value={value}
          required={required}
          disabled={list.loading}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{required ? t("请选择") : t("不限")}</option>
          {value && !list.data?.items.some((r) => r.id === value) && (
            <option value={value}>{value}</option>
          )}
          {list.data?.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {(query || (list.data?.total ?? 0) > 100 || offset > 0) && (
        <div className="inline-actions">
          <input
            aria-label={`${t("搜索")}${label}`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOffset(0);
            }}
          />
          <button
            type="button"
            aria-label={t("上一页")}
            disabled={!offset}
            onClick={() => setOffset(offset - 100)}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label={t("下一页")}
            disabled={offset + 100 >= (list.data?.total ?? 0)}
            onClick={() => setOffset(offset + 100)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
      {list.error && <Notice>{list.error}</Notice>}
    </div>
  );
}

export function CampusDomain({ user }: { user: PublicUser }) {
  const [collection, setCollection] =
    useState<CampusCollection>("universities");
  const [university, setUniversity] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<CampusRecord | null | undefined>();
  const [deleting, setDeleting] = useState<CampusRecord>();
  const [directoryVersion, setDirectoryVersion] = useState(0);
  const action = useAction();
  const list = useLoad<Page>(
    `/api/campus/${collection}?limit=20&offset=${offset}&q=${encodeURIComponent(query)}${university ? `&universityId=${university}` : ""}`,
  );
  const canEdit = (r: CampusRecord) =>
    user.role === "admin" || r.owner_id === user.id;
  return (
    <div className="campus-directory">
      <div className="section-head">
        <h2>{t("校园目录")}</h2>
        <button onClick={() => setEditing(null)}>
          <Plus size={16} />
          {t("新增资料")}
        </button>
      </div>
      <div className="tabs">
        {(Object.keys(titles) as CampusCollection[]).map((kind) => (
          <button
            key={kind}
            className={collection === kind ? "selected" : ""}
            onClick={() => {
              setCollection(kind);
              setOffset(0);
              setQuery("");
            }}
          >
            {t(titles[kind])}
          </button>
        ))}
      </div>
      <div className="campus-filters">
        <CampusPicker
          key={directoryVersion}
          collection="universities"
          value={university}
          onChange={(id) => {
            setUniversity(id);
            setOffset(0);
          }}
          label={t("所属学校")}
        />
        <label>
          {t("搜索资料")}
          <span className="campus-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOffset(0);
              }}
            />
          </span>
        </label>
      </div>
      {list.error && <Notice>{list.error}</Notice>}
      {action.error && <Notice>{action.error}</Notice>}
      {list.loading ? (
        <Loading />
      ) : !list.data?.items.length ? (
        <Empty>{t("暂无校园资料")}</Empty>
      ) : (
        <div className="campus-records">
          {list.data.items.map((record) => (
            <div className="campus-record" key={record.id}>
              <MapPin size={20} />
              <div>
                <strong>{record.name}</strong>
                <span>
                  {record.code ||
                    record.timezone ||
                    (record.capacity
                      ? `${t("容量")} ${record.capacity}`
                      : record.description ||
                        (collection === "universities"
                          ? ""
                          : record.university_name))}
                </span>
              </div>
              {canEdit(record) && (
                <div className="inline-actions">
                  <button
                    aria-label={`${t("编辑")}${record.name}`}
                    onClick={() => setEditing(record)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    aria-label={`${t("删除")}${record.name}`}
                    onClick={() => setDeleting(record)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="campus-pagination">
        <button
          aria-label={t("上一页")}
          disabled={offset === 0 || list.loading}
          onClick={() => setOffset(offset - 20)}
        >
          <ChevronLeft size={18} />
        </button>
        <span>
          {list.data?.total ?? 0} · {Math.floor(offset / 20) + 1}
        </span>
        <button
          aria-label={t("下一页")}
          disabled={offset + 20 >= (list.data?.total ?? 0) || list.loading}
          onClick={() => setOffset(offset + 20)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <Affiliations />
      {editing !== undefined && (
        <Modal
          title={`${t(editing ? "编辑" : "新增")}${t(titles[collection])}`}
          onClose={() => setEditing(undefined)}
        >
          <CampusForm
            collection={collection}
            initial={editing}
            defaultUniversity={university}
            onSaved={async () => {
              setEditing(undefined);
              await list.refresh();
              setDirectoryVersion((version) => version + 1);
            }}
          />
        </Modal>
      )}
      {deleting && (
        <Modal title={t("删除校园资料")} onClose={() => setDeleting(undefined)}>
          <p>{deleting.name}</p>
          <button
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                await api(`/api/campus/${collection}/${deleting.id}`, {
                  method: "DELETE",
                });
                setDeleting(undefined);
                await list.refresh();
                setDirectoryVersion((version) => version + 1);
              })
            }
          >
            <Trash2 size={16} />
            {t("确认删除")}
          </button>
          <button onClick={() => setDeleting(undefined)}>{t("取消")}</button>
          {action.error && <Notice>{action.error}</Notice>}
        </Modal>
      )}
    </div>
  );
}

function CampusForm({
  collection,
  initial,
  defaultUniversity,
  onSaved,
}: {
  collection: CampusCollection;
  initial: CampusRecord | null;
  defaultUniversity: string;
  onSaved: () => Promise<void>;
}) {
  const action = useAction();
  const [university, setUniversity] = useState(
    initial?.university_id ?? defaultUniversity,
  );
  const [campus, setCampus] = useState(initial?.campus_id ?? "");
  const [building, setBuilding] = useState(initial?.building_id ?? "");
  return (
    <form
      className="campus-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void action.run(async () => {
          const raw = {
            name: String(form.get("name")),
            ...(collection === "universities"
              ? { allow_affiliations: form.get("allow_affiliations") === "on" }
              : { university_id: university }),
            ...(collection === "campuses"
              ? { timezone: String(form.get("timezone")) }
              : {}),
            ...(!["universities", "campuses"].includes(collection)
              ? { campus_id: campus || null }
              : {}),
            ...(collection === "venues"
              ? {
                  building_id: building || null,
                  capacity: Number(form.get("capacity")),
                  latitude: form.get("latitude")
                    ? Number(form.get("latitude"))
                    : null,
                  longitude: form.get("longitude")
                    ? Number(form.get("longitude"))
                    : null,
                }
              : {}),
            ...(collection === "courses"
              ? { code: String(form.get("code")) }
              : {}),
            ...(collection === "clubs"
              ? { description: String(form.get("description")) }
              : {}),
          };
          const parsed = campusSchemas[collection].safeParse(raw);
          if (!parsed.success)
            throw new Error(
              parsed.error.issues
                .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
                .join("; "),
            );
          await api(
            `/api/campus/${collection}${initial ? `/${initial.id}` : ""}`,
            {
              method: initial ? "PUT" : "POST",
              body: JSON.stringify(parsed.data),
            },
          );
          await onSaved();
        });
      }}
    >
      <label>
        {t("资料名称")}
        <input
          name="name"
          required
          maxLength={160}
          defaultValue={initial?.name}
        />
      </label>
      {collection !== "universities" && (
        <fieldset disabled={!!initial}>
          <CampusPicker
            collection="universities"
            value={university}
            onChange={(id) => {
              setUniversity(id);
              setCampus("");
              setBuilding("");
            }}
            label={t("所属学校")}
            required
          />
          {!["universities", "campuses"].includes(collection) && (
            <CampusPicker
              key={university}
              collection="campuses"
              university={university}
              value={campus}
              onChange={(id) => {
                setCampus(id);
                setBuilding("");
              }}
              label={t("所属校区")}
              required={["buildings", "venues"].includes(collection)}
            />
          )}
          {collection === "venues" && (
            <CampusPicker
              key={`${university}-${campus}`}
              collection="buildings"
              university={university}
              campus={campus}
              value={building}
              onChange={setBuilding}
              label={t("所属建筑")}
            />
          )}
        </fieldset>
      )}
      {collection === "universities" && (
        <label className="campus-checkbox">
          <input
            type="checkbox"
            name="allow_affiliations"
            defaultChecked={initial?.allow_affiliations ?? true}
          />
          {t("接受自填学生关系")}
        </label>
      )}
      {collection === "campuses" && (
        <label>
          {t("时区")}
          <input
            required
            name="timezone"
            defaultValue={initial?.timezone ?? "Asia/Shanghai"}
          />
        </label>
      )}
      {collection === "venues" && (
        <>
          <label>
            {t("容量")}
            <input
              type="number"
              name="capacity"
              required
              min={1}
              max={100000}
              defaultValue={initial?.capacity ?? 1}
            />
          </label>
          <label>
            {t("纬度")}
            <input
              type="number"
              step="any"
              name="latitude"
              min={-90}
              max={90}
              defaultValue={initial?.latitude ?? ""}
            />
          </label>
          <label>
            {t("经度")}
            <input
              type="number"
              step="any"
              name="longitude"
              min={-180}
              max={180}
              defaultValue={initial?.longitude ?? ""}
            />
          </label>
        </>
      )}
      {collection === "courses" && (
        <label>
          {t("课程代码")}
          <input
            name="code"
            required
            maxLength={40}
            defaultValue={initial?.code}
          />
        </label>
      )}
      {collection === "clubs" && (
        <label>
          {t("简介")}
          <textarea
            name="description"
            maxLength={2000}
            defaultValue={initial?.description}
          />
        </label>
      )}
      {action.error && <Notice>{action.error}</Notice>}
      <button disabled={action.busy}>
        <Save size={16} />
        {t("保存")}
      </button>
    </form>
  );
}

function Affiliations() {
  const data = useLoad<{
    items: {
      university_id: string;
      university_name: string;
      campus_name: string | null;
      program: string;
    }[];
  }>("/api/campus/me/affiliations");
  const [open, setOpen] = useState(false),
    [university, setUniversity] = useState(""),
    [campus, setCampus] = useState("");
  const action = useAction();
  return (
    <section className="campus-affiliations">
      <div className="section-head">
        <h3>{t("我的学校关系")}</h3>
        <button onClick={() => setOpen(!open)}>
          <Plus size={16} />
          {t("添加学校关系")}
        </button>
      </div>
      {data.error && <Notice>{data.error}</Notice>}
      {action.error && <Notice>{action.error}</Notice>}
      {data.data?.items.map((item) => (
        <div className="campus-record" key={item.university_id}>
          <div>
            <strong>{item.university_name}</strong>
            <span>
              {[item.campus_name, item.program, t("自主声明，非官方认证")]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          <button
            aria-label={`${t("移除")}${item.university_name}`}
            onClick={() =>
              void action.run(async () => {
                await api(`/api/campus/me/affiliations/${item.university_id}`, {
                  method: "DELETE",
                });
                await data.refresh();
              })
            }
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      {open && (
        <form
          className="campus-form"
          onSubmit={(event) => {
            event.preventDefault();
            const values = new FormData(event.currentTarget);
            void action.run(async () => {
              await api("/api/campus/me/affiliations", {
                method: "PUT",
                body: JSON.stringify({
                  university_id: university,
                  campus_id: campus || null,
                  program: values.get("program"),
                }),
              });
              setOpen(false);
              await data.refresh();
            });
          }}
        >
          <CampusPicker
            collection="universities"
            value={university}
            onChange={(id) => {
              setUniversity(id);
              setCampus("");
            }}
            label={t("所属学校")}
            required
          />
          <CampusPicker
            key={university}
            collection="campuses"
            value={campus}
            onChange={setCampus}
            university={university}
            label={t("所属校区")}
          />
          <label>
            {t("专业或学习方向")}
            <input name="program" maxLength={160} />
          </label>
          <button disabled={action.busy}>
            <Save size={16} />
            {t("保存")}
          </button>
        </form>
      )}
    </section>
  );
}

type EventLocation = {
  university_id: string;
  venue_id: string | null;
  club_id: string | null;
  university_name: string;
  venue_name: string | null;
  club_name: string | null;
  latitude: number | null;
  longitude: number | null;
};
export function EventCampusLocation({
  eventId,
  editable,
}: {
  eventId: string;
  editable: boolean;
}) {
  const data = useLoad<{ location: EventLocation | null }>(
    `/api/campus/events/${eventId}/location`,
  );
  const [editing, setEditing] = useState(false),
    [university, setUniversity] = useState(""),
    [venue, setVenue] = useState(""),
    [club, setClub] = useState("");
  const action = useAction(),
    location = data.data?.location;
  return (
    <section className="event-campus-location">
      <h3>{t("活动归属与场地")}</h3>
      {data.error && <Notice>{data.error}</Notice>}
      {action.error && <Notice>{action.error}</Notice>}
      {location && (
        <p>
          {[location.university_name, location.venue_name, location.club_name]
            .filter(Boolean)
            .join(" / ")}
        </p>
      )}
      {location?.latitude != null && location?.longitude != null && (
        <a
          target="_blank"
          rel="noopener noreferrer"
          href={`https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=17/${location.latitude}/${location.longitude}`}
        >
          {t("在 OpenStreetMap 中查看")}
        </a>
      )}
      {editable && !editing && (
        <button
          disabled={data.loading}
          onClick={() => {
            setUniversity(location?.university_id ?? "");
            setVenue(location?.venue_id ?? "");
            setClub(location?.club_id ?? "");
            setEditing(true);
          }}
        >
          <Pencil size={16} />
          {t("设置活动场地")}
        </button>
      )}
      {editing && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void action.run(async () => {
              await api(`/api/campus/events/${eventId}/location`, {
                method: "PUT",
                body: JSON.stringify({
                  university_id: university,
                  venue_id: venue || null,
                  club_id: club || null,
                }),
              });
              setEditing(false);
              await data.refresh();
            });
          }}
        >
          <CampusPicker
            collection="universities"
            value={university}
            onChange={(id) => {
              setUniversity(id);
              setVenue("");
              setClub("");
            }}
            label={t("所属学校")}
            required
          />
          <CampusPicker
            key={`v-${university}`}
            collection="venues"
            value={venue}
            onChange={setVenue}
            university={university}
            label={t("活动场地")}
          />
          <CampusPicker
            key={`c-${university}`}
            collection="clubs"
            value={club}
            onChange={setClub}
            university={university}
            label={t("组织社团")}
          />
          <div className="inline-actions">
            <button disabled={action.busy}>
              <Save size={16} />
              {t("保存")}
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              {t("取消")}
            </button>
            {location && (
              <button
                type="button"
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await api(`/api/campus/events/${eventId}/location`, {
                      method: "PUT",
                      body: "null",
                    });
                    setEditing(false);
                    await data.refresh();
                  })
                }
              >
                <Trash2 size={16} />
                {t("解除关联")}
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
