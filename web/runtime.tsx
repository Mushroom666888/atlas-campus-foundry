import { useEffect, useState, type FormEvent } from "react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  ImagePlus,
  LogOut,
  MapPin,
  MessageCircle,
  Package,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Users,
  X,
} from "lucide-react";
import { api, post, useLoad } from "./api";
import { Badge, Empty, Loading, Modal, Notice, useAction } from "./components";
import type { Entity, PublicUser } from "../packages/contracts/src/index";
import type { RuntimeInfo } from "./main";
const labels: Record<string, string> = {
  event: "校园活动",
  listing: "二手好物",
  group: "学习小组",
  profile: "学习伙伴",
  course: "课程主题",
  location: "校园地点",
  post: "动态与资料",
  school: "学校",
};
const icons: Record<string, typeof CalendarDays> = {
  event: CalendarDays,
  listing: ShoppingBag,
  group: Users,
  profile: Users,
  course: BookOpen,
  location: MapPin,
  post: BookOpen,
  school: BookOpen,
};
export function CampusApplication({
  info,
  user,
  onLogout,
}: {
  info: RuntimeInfo;
  user: PublicUser;
  onLogout: () => void;
}) {
  const order =
    info.spec.kind === "marketplace"
      ? [
          "listing",
          "post",
          "profile",
          "group",
          "event",
          "course",
          "location",
          "school",
        ]
      : info.spec.kind === "study"
        ? [
            "group",
            "profile",
            "course",
            "post",
            "location",
            "event",
            "listing",
            "school",
          ]
        : [
            "event",
            "group",
            "location",
            "post",
            "school",
            "profile",
            "course",
            "listing",
          ];
  const access: Record<string, string> = {
    event: "events",
    listing: "content",
    post: "content",
    group: "groups",
    profile: "profiles",
    course: "groups",
    location: "campus",
    school: "campus",
  };
  const kinds = order.filter((k) => info.modules.includes(access[k]));
  const [view, setView] = useState(kinds[0] ?? "post"),
    [account, setAccount] = useState(false);
  return (
    <div className={`campus-app theme-${info.spec.primaryColor}`}>
      <header className="app-header">
        <div className="app-brand">
          <span className="brand-symbol">
            <Package size={22} />
          </span>
          <div>
            <strong>{info.spec.name}</strong>
            <span>校园社区</span>
          </div>
        </div>
        <div className="inline-actions">
          {info.modules.includes("notifications") && (
            <button
              className={`icon-button ${view === "notifications" ? "active" : ""}`}
              title="通知"
              aria-label="通知"
              onClick={() => setView("notifications")}
            >
              <Bell size={20} />
            </button>
          )}
          {info.modules.includes("chat") && (
            <button
              className={`icon-button ${view === "chat" ? "active" : ""}`}
              title="聊天"
              aria-label="聊天"
              onClick={() => setView("chat")}
            >
              <MessageCircle size={20} />
            </button>
          )}
          <button
            className="avatar-button"
            title="账户"
            aria-label="账户"
            onClick={() => setAccount(true)}
          >
            {user.name.slice(0, 1)}
          </button>
          <button
            className="icon-button"
            title="退出"
            aria-label="退出"
            onClick={() => void post("/api/auth/logout").then(onLogout)}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <div className="app-intro">
        <span className="eyebrow">
          {info.spec.kind === "events"
            ? "CAMPUS EVENTS"
            : info.spec.kind === "marketplace"
              ? "CAMPUS MARKETPLACE"
              : info.spec.kind === "study"
                ? "STUDY BUDDY"
                : "CAMPUS COMMUNITY"}
        </span>
        <h1>{info.spec.name}</h1>
        <p>{info.spec.description}</p>
      </div>
      <nav className="app-tabs">
        {kinds.map((kind) => {
          const Icon = icons[kind];
          return (
            <button
              key={kind}
              className={view === kind ? "selected" : ""}
              onClick={() => setView(kind)}
            >
              <Icon size={17} />
              {labels[kind]}
            </button>
          );
        })}
      </nav>
      <main className="app-content">
        {view === "chat" ? (
          <Chat user={user} />
        ) : view === "notifications" ? (
          <Notifications />
        ) : (
          <EntityView key={view} kind={view} info={info} user={user} />
        )}
      </main>
      <footer className="app-footer">
        {info.spec.name}
        <span>Powered by Campus Foundry</span>
      </footer>
      {account && (
        <Modal title="我的账户" onClose={() => setAccount(false)}>
          <Account user={user} />
        </Modal>
      )}
    </div>
  );
}
function EntityView({
  kind,
  info,
  user,
}: {
  kind: string;
  info: RuntimeInfo;
  user: PublicUser;
}) {
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [create, setCreate] = useState(false),
    [selected, setSelected] = useState<Entity | null>(null);
  const entities = useLoad<{ items: Entity[] }>(
    `/api/entities?kind=${kind}&q=${encodeURIComponent(search)}`,
  );
  const Icon = icons[kind];
  return (
    <>
      <div className="section-head">
        <h2>{labels[kind]}</h2>
        <button className="primary" onClick={() => setCreate(true)}>
          <Plus size={17} />
          {kind === "profile"
            ? "创建学习资料"
            : kind === "location"
              ? "添加地点"
              : kind === "group"
                ? "创建小组"
                : "发布"}
        </button>
      </div>
      {info.modules.includes("search") && (
        <form
          className="toolbar search-form"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query);
          }}
        >
          <div className="search-input">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="搜索内容"
              placeholder={`搜索${labels[kind]}`}
            />
          </div>
          <button type="submit">搜索</button>
        </form>
      )}
      {entities.error && <Notice>{entities.error}</Notice>}
      {entities.loading ? (
        <Loading />
      ) : entities.data?.items.length ? (
        <div
          className={`entity-grid ${kind === "listing" ? "market-grid" : ""}`}
        >
          {entities.data.items.map((item) => (
            <button
              className="entity-card"
              key={item.id}
              onClick={() => setSelected(item)}
            >
              {typeof item.data.imageId === "string" ? (
                <img
                  className="entity-image"
                  src={`/api/uploads/${item.data.imageId}`}
                  alt={item.title}
                />
              ) : (
                <div className={`entity-visual visual-${kind}`}>
                  <Icon size={35} />
                  {kind === "event" && typeof item.data.date === "string" && (
                    <span>
                      {new Date(item.data.date).toLocaleDateString("zh-CN")}
                    </span>
                  )}
                </div>
              )}
              <div className="entity-copy">
                <div className="section-head">
                  <span className="eyebrow">{labels[kind]}</span>
                  <Badge status={item.status} />
                </div>
                <h3>{item.title}</h3>
                <p>{item.body || "暂无描述"}</p>
                <footer>
                  {kind === "listing" && typeof item.data.price === "number" ? (
                    <strong className="price">
                      ¥ {item.data.price.toFixed(2)}
                    </strong>
                  ) : typeof item.data.capacity === "number" ? (
                    <span>
                      <Users size={14} />
                      {item.data.capacity} 人上限
                    </span>
                  ) : (
                    <span>
                      {new Date(item.created_at).toLocaleDateString("zh-CN")}
                    </span>
                  )}
                  <ChevronRight size={17} />
                </footer>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Empty>还没有{labels[kind]}，发布第一条内容。</Empty>
      )}
      {create && (
        <Modal
          title={kind === "location" ? "添加校园地点" : `发布${labels[kind]}`}
          onClose={() => setCreate(false)}
        >
          <EntityForm
            kind={kind}
            info={info}
            onSaved={async () => {
              setCreate(false);
              await entities.refresh();
            }}
          />
        </Modal>
      )}
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <EntityDetail
            initial={selected}
            user={user}
            info={info}
            onChange={async (next) => {
              setSelected(next);
              await entities.refresh();
            }}
          />
        </Modal>
      )}
    </>
  );
}
function EntityForm({
  kind,
  info,
  onSaved,
}: {
  kind: string;
  info: RuntimeInfo;
  onSaved: () => Promise<void>;
}) {
  const action = useAction();
  const [imageId, setImageId] = useState("");
  const locations = useLoad<{ items: Entity[] }>(
    `/api/entities?kind=${info.modules.includes("campus") ? "location" : kind}`,
  );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    const data: Record<string, unknown> = {};
    for (const field of ["capacity", "price", "latitude", "longitude"])
      if (values[field] !== undefined && values[field] !== "")
        data[field] = Number(values[field]);
    for (const field of ["date", "locationId", "course", "interests"])
      if (values[field]) data[field] = values[field];
    if (imageId) data.imageId = imageId;
    void action.run(async () => {
      await post("/api/entities", {
        kind,
        title: values.title,
        body: values.body,
        data,
      });
      await onSaved();
    });
  }
  return (
    <form onSubmit={submit}>
      <label>
        {kind === "profile" ? "姓名或称呼" : "标题"}
        <input name="title" required maxLength={160} />
      </label>
      <label>
        {kind === "profile" ? "学习介绍" : "描述"}
        <textarea name="body" rows={3} maxLength={10000} />
      </label>
      {["event", "group"].includes(kind) && (
        <label>
          人数上限
          <input
            name="capacity"
            type="number"
            min={1}
            max={100000}
            defaultValue={20}
            required
          />
        </label>
      )}
      {kind === "event" && (
        <label>
          活动时间
          <input name="date" type="datetime-local" required />
        </label>
      )}
      {kind === "listing" && (
        <label>
          价格（元）
          <input
            name="price"
            type="number"
            min={0}
            max={1000000}
            step="0.01"
            required
          />
        </label>
      )}
      {["profile", "group", "course"].includes(kind) && (
        <label>
          课程或学习主题
          <input name="course" maxLength={120} />
        </label>
      )}
      {kind === "profile" && (
        <label>
          兴趣与可用时间
          <input name="interests" maxLength={300} />
        </label>
      )}
      {kind === "location" && (
        <div className="form-row">
          <label>
            纬度
            <input
              name="latitude"
              type="number"
              min={-90}
              max={90}
              step="any"
              required
            />
          </label>
          <label>
            经度
            <input
              name="longitude"
              type="number"
              min={-180}
              max={180}
              step="any"
              required
            />
          </label>
        </div>
      )}
      {["event", "group"].includes(kind) && info.modules.includes("campus") && (
        <label>
          地点
          <select name="locationId">
            <option value="">暂未确定</option>
            {locations.data?.items.map((item) => (
              <option value={item.id} key={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {["listing", "post"].includes(kind) && info.modules.includes("media") && (
        <label className="upload-field">
          <ImagePlus size={22} />
          {imageId ? "图片已上传" : "上传图片"}
          <input
            aria-label="上传图片"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void action.run(async () => {
                  const form = new FormData();
                  form.append("image", file);
                  const result = await api<{ id: string }>("/api/uploads", {
                    method: "POST",
                    body: form,
                  });
                  setImageId(result.id);
                });
            }}
          />
          {imageId && (
            <img
              className="upload-preview"
              src={`/api/uploads/${imageId}`}
              alt="待发布图片"
            />
          )}
        </label>
      )}
      {action.error && <Notice>{action.error}</Notice>}
      <button className="primary" disabled={action.busy}>
        <Plus size={16} />
        {action.busy ? "正在保存…" : "发布"}
      </button>
    </form>
  );
}
function EntityDetail({
  initial,
  user,
  info,
  onChange,
}: {
  initial: Entity;
  user: PublicUser;
  info: RuntimeInfo;
  onChange: (next: Entity) => Promise<void>;
}) {
  const action = useAction(),
    [editing, setEditing] = useState(false);
  const item = initial;
  return (
    <div className="entity-detail">
      {typeof item.data.imageId === "string" && (
        <img
          src={`/api/uploads/${item.data.imageId}`}
          className="detail-image"
          alt={item.title}
        />
      )}
      <Badge status={item.status} />
      <p className="entity-body">{item.body}</p>
      <dl className="definition-list">
        {Object.entries(item.data)
          .filter(([key]) => !["imageId", "locationId"].includes(key))
          .map(([key, value]) => (
            <div key={key}>
              <dt>
                {{
                  capacity: "人数上限",
                  price: "价格",
                  date: "时间",
                  course: "学习主题",
                  interests: "兴趣与时间",
                  latitude: "纬度",
                  longitude: "经度",
                }[key] ?? key}
              </dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
      </dl>
      {typeof item.data.locationId === "string" && (
        <LocationName id={item.data.locationId} />
      )}
      <div className="inline-actions">
        {item.kind === "location" && (
          <button
            onClick={() =>
              void action.run(async () => {
                const map = await api<{ url: string }>(
                  `/api/locations/${item.id}/map`,
                );
                window.open(map.url, "_blank", "noopener,noreferrer");
              })
            }
          >
            <MapPin size={16} />在 OpenStreetMap 中查看
          </button>
        )}
        {item.kind === "school" && (
          <button
            onClick={() =>
              void action.run(
                () => post(`/api/schools/${item.id}/join`),
                "已加入学校（自主声明，非官方认证）",
              )
            }
          >
            <Plus size={16} />
            加入学校
          </button>
        )}
        {info.modules.includes("chat") && item.owner_id !== user.id && (
          <button
            onClick={() =>
              void action.run(async () => {
                await post("/api/conversations", {
                  title: item.title,
                  members: [item.owner_id],
                  entityId: item.id,
                });
              }, "会话已创建，请打开聊天查看")
            }
          >
            <MessageCircle size={16} />
            {item.kind === "listing" ? "联系卖家" : "发起聊天"}
          </button>
        )}
        {item.owner_id === user.id && (
          <>
            <button onClick={() => setEditing(!editing)}>编辑内容</button>
            <button
              onClick={() =>
                void action.run(async () => {
                  const next = await api<Entity>(`/api/entities/${item.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      status:
                        item.status === "active"
                          ? item.kind === "listing"
                            ? "sold"
                            : "closed"
                          : "active",
                    }),
                  });
                  await onChange(next);
                }, "状态已更新")
              }
            >
              <Check size={16} />
              {item.status === "active"
                ? item.kind === "listing"
                  ? "标记已售"
                  : "关闭"
                : "重新开放"}
            </button>
          </>
        )}
      </div>
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const values = Object.fromEntries(new FormData(e.currentTarget));
            void action.run(async () => {
              await onChange(
                await api<Entity>(`/api/entities/${item.id}`, {
                  method: "PATCH",
                  body: JSON.stringify(values),
                }),
              );
              setEditing(false);
            });
          }}
        >
          <label>
            标题
            <input name="title" defaultValue={item.title} required />
          </label>
          <label>
            描述
            <textarea name="body" defaultValue={item.body} />
          </label>
          <button className="primary">
            <Check size={16} />
            保存修改
          </button>
        </form>
      )}
      {["event", "group"].includes(item.kind) && (
        <Membership id={item.id} active={item.status === "active"} />
      )}{" "}
      {action.error && <Notice>{action.error}</Notice>}
      {action.message && <Notice kind="success">{action.message}</Notice>}
    </div>
  );
}
function LocationName({ id }: { id: string }) {
  const location = useLoad<Entity>(`/api/entities/${id}`);
  return (
    <p className="location-line">
      <MapPin size={16} />
      {location.data?.title ?? "正在加载地点"}
    </p>
  );
}
function Membership({ id, active }: { id: string; active: boolean }) {
  const data = useLoad<{
    mine: { status: string; position: number } | null;
    counts: { status: string; count: number }[];
    members: { user_id: string; name: string; status: string }[];
  }>(`/api/entities/${id}/members`);
  const action = useAction();
  return (
    <section className="membership">
      <div className="section-head">
        <h3>报名情况</h3>
        <span>
          {data.data?.counts.find((c) => c.status === "joined")?.count ?? 0}{" "}
          人已加入 ·{" "}
          {data.data?.counts.find((c) => c.status === "waiting")?.count ?? 0}{" "}
          人候补
        </span>
      </div>
      {data.data?.mine ? (
        <div className="inline-actions">
          <Badge status={data.data.mine.status} />
          <button
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                await post(`/api/entities/${id}/leave`);
                await data.refresh();
              }, "已退出")
            }
          >
            <X size={15} />
            退出报名
          </button>
        </div>
      ) : (
        <button
          className="primary"
          disabled={action.busy || !active}
          onClick={() =>
            void action.run(async () => {
              await post(`/api/entities/${id}/join`);
              await data.refresh();
            }, "报名状态已更新")
          }
        >
          <Plus size={16} />
          报名加入
        </button>
      )}
      {data.data?.members.length ? (
        <ul className="member-list">
          {data.data.members.map((m) => (
            <li key={m.user_id}>
              <span>{m.name}</span>
              <Badge status={m.status} />
            </li>
          ))}
        </ul>
      ) : null}
      {action.error && <Notice>{action.error}</Notice>}
      {action.message && <Notice kind="success">{action.message}</Notice>}
    </section>
  );
}
function Chat({ user }: { user: PublicUser }) {
  const conversations = useLoad<{ items: { id: string; title: string }[] }>(
      "/api/conversations",
      5000,
    ),
    people = useLoad<{ items: { id: string; name: string }[] }>("/api/people");
  const [selected, setSelected] = useState(""),
    [create, setCreate] = useState(false);
  const action = useAction();
  return (
    <>
      <div className="section-head">
        <h2>聊天</h2>
        <button className="primary" onClick={() => setCreate(true)}>
          <Plus size={16} />
          新建会话
        </button>
      </div>
      <section className="chat-layout">
        <div className="conversation-list">
          {conversations.data?.items.length ? (
            conversations.data.items.map((c) => (
              <button
                className={selected === c.id ? "selected" : ""}
                key={c.id}
                onClick={() => setSelected(c.id)}
              >
                <MessageCircle size={18} />
                {c.title}
              </button>
            ))
          ) : (
            <Empty>还没有会话</Empty>
          )}
        </div>
        {selected ? (
          <Messages id={selected} user={user} />
        ) : (
          <Empty>选择一个会话</Empty>
        )}
      </section>
      {create && (
        <Modal title="新建会话" onClose={() => setCreate(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              void action.run(async () => {
                const result = await post<{ id: string }>(
                  "/api/conversations",
                  { title: values.title, members: [values.member] },
                );
                setSelected(result.id);
                setCreate(false);
                await conversations.refresh();
              });
            }}
          >
            <label>
              会话名称
              <input name="title" required maxLength={100} />
            </label>
            <label>
              联系谁
              <select name="member" required>
                <option value="">选择成员</option>
                {people.data?.items
                  .filter((p) => p.id !== user.id)
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            {action.error && <Notice>{action.error}</Notice>}
            <button className="primary" disabled={action.busy}>
              <Plus size={16} />
              创建会话
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Messages({ id, user }: { id: string; user: PublicUser }) {
  const messages = useLoad<{
    items: {
      id: string;
      sender_id: string;
      sender_name: string;
      body: string;
      created_at: string;
    }[];
  }>(`/api/conversations/${id}/messages`);
  const action = useAction();
  useEffect(() => {
    const stream = new EventSource("/api/stream");
    stream.onmessage = () => void messages.refresh();
    return () => stream.close();
  }, [messages.refresh]);
  return (
    <div className="messages">
      <div className="message-history">
        {messages.data?.items.map((m) => (
          <div
            key={m.id}
            className={`message ${m.sender_id === user.id ? "mine" : ""}`}
          >
            <small>
              {m.sender_name} ·{" "}
              {new Date(m.created_at).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
            <p>{m.body}</p>
          </div>
        ))}
        {!messages.data?.items.length && <Empty>开始你们的对话</Empty>}
      </div>
      {action.error && <Notice>{action.error}</Notice>}
      <form
        className="message-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const values = Object.fromEntries(new FormData(form));
          void action.run(async () => {
            await post(`/api/conversations/${id}/messages`, {
              body: values.body,
            });
            form.reset();
            await messages.refresh();
          });
        }}
      >
        <input
          name="body"
          aria-label="聊天消息"
          required
          maxLength={4000}
          placeholder="发送消息…"
        />
        <button
          className="primary"
          disabled={action.busy}
          aria-label="发送消息"
          title="发送消息"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
function Notifications() {
  const notifications = useLoad<{
    items: { id: string; body: string; read_at: string | null }[];
  }>("/api/notifications", 5000);
  const action = useAction();
  return (
    <section>
      <h2>通知</h2>
      {action.error && <Notice>{action.error}</Notice>}
      {notifications.data?.items.length ? (
        notifications.data.items.map((n) => (
          <div
            className={`notification-row ${n.read_at ? "read" : ""}`}
            key={n.id}
          >
            <Bell size={18} />
            <p>{n.body}</p>
            {!n.read_at && (
              <button
                aria-label="标为已读"
                title="标为已读"
                onClick={() =>
                  void action.run(async () => {
                    await post(`/api/notifications/${n.id}/read`);
                    await notifications.refresh();
                  })
                }
              >
                <Check size={16} />
              </button>
            )}
          </div>
        ))
      ) : (
        <Empty>暂无通知</Empty>
      )}
    </section>
  );
}
function Account({ user }: { user: PublicUser }) {
  const action = useAction();
  return (
    <>
      <dl className="definition-list">
        <div>
          <dt>称呼</dt>
          <dd>{user.name}</dd>
        </div>
        <div>
          <dt>邮箱</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt>验证状态</dt>
          <dd>{user.verified ? "邮箱已验证" : "邮箱未验证"}</dd>
        </div>
      </dl>
      <button
        onClick={() =>
          void action.run(async () => {
            const result = await post<{ message: string }>(
              "/api/auth/verify-email/request",
            );
            action.setError("");
            throw new Error(result.message);
          })
        }
      >
        发送验证邮件
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const values = Object.fromEntries(new FormData(e.currentTarget));
          void action.run(
            () => post("/api/auth/verify-email", values),
            "邮箱已验证，重新登录后更新账户状态",
          );
        }}
      >
        <label>
          验证码
          <input name="token" required />
        </label>
        <button>
          <Check size={16} />
          验证邮箱
        </button>
      </form>
      {action.error && <Notice kind="info">{action.error}</Notice>}
      {action.message && <Notice kind="success">{action.message}</Notice>}
    </>
  );
}
