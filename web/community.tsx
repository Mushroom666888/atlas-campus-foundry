import { t, LanguageSelect, localeTag } from "./i18n";
import {
  createContext,
  useContext,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
  Navigate,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  MessageCircle,
  MoveUpRight,
  Pencil,
  Plus,
  Search,
  Send,
  Store,
  Trash2,
  UserRound,
} from "lucide-react";
import type { PublicUser } from "../packages/contracts/src/index";
import {
  postCategories,
  productCategories,
  type CreatorProfile,
  type CreatorProduct,
  type CommunityPost,
  type CommunityReply,
  type CommunityPage,
} from "../packages/contracts/src/community";
import { api, post, useLoad } from "./api";
import { Empty, Loading, Modal, Notice, useAction } from "./components";
import "./community.css";

type User = PublicUser | null;
const CommunityContext = createContext<{
  runtime: boolean;
  has: (id: string) => boolean;
}>({ runtime: false, has: () => true });
const date = (value: string) => new Date(value).toLocaleDateString(localeTag());
const parseTags = (value: string) =>
  value
    .split(/[,，]/)
    .map((v) => v.trim())
    .filter(Boolean);
function Tags({ values }: { values: string[] }) {
  return (
    <div className="community-tags">
      {values.map((t) => (
        <span key={t}>{t}</span>
      ))}
    </div>
  );
}
function Author({
  id,
  name,
  school,
}: {
  id: string;
  name: string;
  school?: string;
}) {
  return (
    <Link className="community-author" to={`/creators/${id}`}>
      <span className="creator-avatar">{name.slice(0, 1)}</span>
      <span>
        {name}
        {school && <small>{school}</small>}
      </span>
    </Link>
  );
}
function Pager({
  page,
  hasMore,
  onPage,
}: {
  page: number;
  hasMore: boolean;
  onPage: (page: number) => void;
}) {
  return (
    <div className="community-pager">
      <button
        aria-label={t("上一页")}
        title={t("上一页")}
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft size={18} />
      </button>
      <span>
        {t("第")}
        {page}
        {t("页")}
      </span>
      <button
        aria-label={t("下一页")}
        title={t("下一页")}
        disabled={!hasMore}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
function DeleteButton({
  url,
  onDeleted,
}: {
  url: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false),
    action = useAction();
  return (
    <>
      <button
        className="icon-button"
        title={t("删除")}
        aria-label={t("删除")}
        onClick={() => setOpen(true)}
      >
        <Trash2 size={17} />
      </button>
      {open && (
        <Modal title={t("确认删除这条内容？")} onClose={() => setOpen(false)}>
          <p>{t("删除后将不再公开展示。讨论下的回复也会一起删除。")}</p>
          {action.error && <Notice>{action.error}</Notice>}
          <div className="inline-actions">
            <button onClick={() => setOpen(false)}>{t("保留")}</button>
            <button
              className="danger"
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await api(url, { method: "DELETE" });
                  setOpen(false);
                  onDeleted();
                })
              }
            >
              {t("确认删除")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function Community({
  user,
  modules,
  brand = "atlas",
}: {
  user: User;
  modules?: string[];
  brand?: string;
}) {
  const runtime = Boolean(modules),
    has = (id: string) => !modules || modules.includes(id);
  const fallback = has("member-directory")
    ? "/community/creators"
    : has("product-showcase")
      ? "/community/products"
      : user
        ? `/creators/${user.id}`
        : "/login";
  return (
    <CommunityContext.Provider value={{ runtime, has }}>
      <div className="community-shell">
        <header className="community-nav">
          <Link className="atlas-logo" to="/">
            <MoveUpRight strokeWidth={3} />
            <span>{brand}</span>
          </Link>
          <nav aria-label={t("社区导航")}>
            {has("discussion-forum") && (
              <NavLink end to="/community">
                {t("创作者论坛")}
              </NavLink>
            )}
            {has("product-showcase") && (
              <NavLink to="/community/products">{t("产品广场")}</NavLink>
            )}
            {has("member-directory") && (
              <NavLink to="/community/creators">{t("发现创作者")}</NavLink>
            )}
            {user && (
              <NavLink to={`/creators/${user.id}`}>{t("我的主页")}</NavLink>
            )}
          </nav>
          <LanguageSelect />
          <Link
            className="button"
            to={user ? (runtime ? "/" : "/studio") : "/login"}
          >
            {user ? (runtime ? t("返回应用") : t("工作台")) : t("登录 / 注册")}
            <ArrowUpRight size={17} />
          </Link>
        </header>
        <main className="community-main">
          <Routes>
            <Route
              path="/community"
              element={
                has("discussion-forum") ? (
                  <CommunityFeed key="forum" user={user} />
                ) : (
                  <Navigate to={fallback} replace />
                )
              }
            />
            {has("member-directory") && (
              <Route
                path="/community/creators"
                element={<CreatorDirectory />}
              />
            )}
            {has("product-showcase") && (
              <>
                <Route
                  path="/community/products"
                  element={
                    <CommunityFeed key="products" user={user} products />
                  }
                />
                <Route
                  path="/community/products/:id"
                  element={<ProductDetail user={user} />}
                />
              </>
            )}
            {has("discussion-forum") && (
              <Route
                path="/community/posts/:id"
                element={<PostDetail user={user} />}
              />
            )}
            <Route path="/creators/:id" element={<CreatorPage user={user} />} />
            <Route
              path="*"
              element={<Empty>{t("此应用没有安装对应的社区模块")}</Empty>}
            />
          </Routes>
        </main>
        <footer className="community-footer">
          <span>ATLAS / CREATOR NETWORK</span>
          <Link to={runtime ? "/" : "/modules"}>
            {runtime ? t("返回应用") : t("发现模块")} <ArrowUpRight size={16} />
          </Link>
        </footer>
      </div>
    </CommunityContext.Provider>
  );
}
function CommunityFeed({
  user,
  products = false,
}: {
  user: User;
  products?: boolean;
}) {
  const [q, setQ] = useState(""),
    [category, setCategory] = useState(""),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState(false);
  const kind = products ? "products" : "posts";
  const { runtime } = useContext(CommunityContext);
  const feed = useLoad<CommunityPage<CreatorProduct | CommunityPost>>(
    `/api/community/${kind}?${new URLSearchParams({ q, category, page: String(page) })}`,
  );
  return (
    <>
      <div className="community-heading">
        <div>
          <span className="eyebrow">
            {products ? "MADE BY CREATORS" : "THE CREATOR NETWORK"}
          </span>
          <h1>
            {products ? t("校园里的下一门生意。") : t("一起，把产品做出来。")}
          </h1>
          <p>
            {products
              ? t("发现独立创作者正在经营的产品。")
              : t("分享进展、交换经验，遇见一起做事的人。")}
          </p>
        </div>
        {user ? (
          <button className="primary" onClick={() => setEditing(true)}>
            <Plus size={18} />
            {products ? t("发布产品") : t("发起讨论")}
          </button>
        ) : (
          <Link className="button primary" to="/login">
            {t("加入社区")}
            <ArrowUpRight size={17} />
          </Link>
        )}
      </div>
      <div className="community-layout">
        <section className="community-feed">
          <form
            className="community-search"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(String(new FormData(e.currentTarget).get("q") || ""));
              setPage(1);
            }}
          >
            <Search size={19} />
            <input
              name="q"
              aria-label={products ? t("搜索产品") : t("搜索讨论")}
              placeholder={products ? t("搜索产品、标签") : t("搜索讨论、标签")}
              maxLength={100}
            />
            <button type="submit">{t("搜索")}</button>
          </form>
          <div className="community-filter" aria-label={t("内容分类")}>
            {["", ...(products ? productCategories : postCategories)].map(
              (c) => (
                <button
                  key={c}
                  aria-pressed={category === c}
                  className={category === c ? "selected" : ""}
                  onClick={() => {
                    setCategory(c);
                    setPage(1);
                  }}
                >
                  {t(c || "全部")}
                </button>
              ),
            )}
          </div>
          {feed.error ? (
            <Notice>{feed.error}</Notice>
          ) : feed.loading ? (
            <Loading />
          ) : feed.data?.items.length ? (
            <div
              className={
                products ? "creator-product-grid" : "community-discussions"
              }
            >
              {feed.data.items.map((item) =>
                products ? (
                  <ProductCard key={item.id} product={item as CreatorProduct} />
                ) : (
                  <PostRow key={item.id} item={item as CommunityPost} />
                ),
              )}
            </div>
          ) : (
            <Empty>
              {products ? t("还没有公开产品。") : t("这里还没有讨论。")}
            </Empty>
          )}
          <Pager
            page={page}
            hasMore={Boolean(feed.data?.hasMore)}
            onPage={setPage}
          />
        </section>
        {!runtime && (
          <aside className="community-aside">
            <span className="eyebrow">BUILD SOMETHING REAL</span>
            <h2>
              {t("从创作者，")}
              <br />
              {t("到经营者。")}
            </h2>
            <p>{t("交易、预约、社区。让你的校园洞察成为有人使用的产品。")}</p>
            <Link to="/modules" className="community-aside-link">
              <Boxes size={20} />
              {t("探索商业模块")}
              <ArrowUpRight size={18} />
            </Link>
            <Link to="/compose" className="community-aside-link">
              <Plus size={20} />
              {t("创建新产品")}
              <ArrowUpRight size={18} />
            </Link>
            {user && (
              <Link
                to={`/creators/${user.id}`}
                className="community-aside-link"
              >
                <UserRound size={20} />
                {t("我的创作者主页")}
                <ArrowUpRight size={18} />
              </Link>
            )}
          </aside>
        )}
      </div>
      {editing &&
        (products ? (
          <ProductEditor
            onClose={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              void feed.refresh();
            }}
          />
        ) : (
          <PostEditor
            onClose={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              void feed.refresh();
            }}
          />
        ))}
    </>
  );
}
function ProductCard({ product: p }: { product: CreatorProduct }) {
  return (
    <article className="creator-product-card">
      <div className="product-mark">
        <Store size={30} />
        <span>{t(p.category)}</span>
        <span className="badge">{t(p.stage)}</span>
      </div>
      <Link to={`/community/products/${p.id}`} className="product-title">
        <h2>{p.name}</h2>
        <ArrowUpRight size={21} />
      </Link>
      <p>{p.tagline}</p>
      <Tags values={p.tags} />
      <Author id={p.owner_id} name={p.author_name} school={p.school} />
    </article>
  );
}
function PostRow({ item: p }: { item: CommunityPost }) {
  return (
    <article className="community-post-row">
      <div className="post-meta">
        <span>{t(p.category)}</span>
        <time>{date(p.created_at)}</time>
      </div>
      <Link to={`/community/posts/${p.id}`}>
        <h2>{p.title}</h2>
      </Link>
      <p>
        {p.body.slice(0, 180)}
        {p.body.length > 180 ? "…" : ""}
      </p>
      <Tags values={p.tags} />
      <div className="post-row-bottom">
        <Author id={p.author_id} name={p.author_name} school={p.school} />
        <Link to={`/community/posts/${p.id}`} className="reply-count">
          <MessageCircle size={17} />
          {p.reply_count}
          {t("条回复")}
        </Link>
      </div>
    </article>
  );
}
function CreatorPage({ user }: { user: User }) {
  const { has, runtime } = useContext(CommunityContext);
  const hasProducts = has("product-showcase"),
    hasPosts = has("discussion-forum"),
    hasFeed = hasProducts || hasPosts;
  const { id } = useParams(),
    profile = useLoad<{ profile: CreatorProfile }>(
      `/api/community/profiles/${id}`,
    ),
    [tab, setTab] = useState(hasProducts ? "products" : "posts"),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState(false),
    [add, setAdd] = useState(false);
  const feed = useLoad<CommunityPage<CreatorProduct | CommunityPost>>(
      hasFeed ? `/api/community/${tab}?owner=${id}&page=${page}` : null,
    ),
    mine = user?.id === id;
  if (profile.error) return <Notice>{profile.error}</Notice>;
  if (!profile.data) return <Loading />;
  const p = profile.data.profile;
  return (
    <>
      <Link className="back-link" to={runtime ? "/" : "/community"}>
        <ArrowLeft size={16} />
        {t("创作者社区")}
      </Link>
      <section className="creator-profile">
        <div className="creator-monogram">{p.display_name.slice(0, 1)}</div>
        <div>
          <span className="eyebrow">ATLAS CREATOR</span>
          <h1>{p.display_name}</h1>
          {p.school && (
            <div className="creator-school">
              <GraduationCap size={20} />
              {p.school}
              <span>{t("本人填写")}</span>
            </div>
          )}
          <p className="preserve-lines">
            {p.bio || "这位创作者还没有填写简介。"}
          </p>
          <Tags values={p.tags} />
          <span className="muted">
            {date(p.created_at)}
            {t("加入")}
          </span>
        </div>
        {mine && (
          <button onClick={() => setEdit(true)}>
            <Pencil size={17} />
            {t("编辑主页")}
          </button>
        )}
      </section>
      {hasFeed && (
        <>
          <div className="section-head creator-section-head">
            <div className="tabs">
              {hasProducts && (
                <button
                  className={tab === "products" ? "selected" : ""}
                  onClick={() => {
                    setTab("products");
                    setPage(1);
                  }}
                >
                  {t("公开产品")}
                </button>
              )}
              {hasPosts && (
                <button
                  className={tab === "posts" ? "selected" : ""}
                  onClick={() => {
                    setTab("posts");
                    setPage(1);
                  }}
                >
                  {t("发起的讨论")}
                </button>
              )}
            </div>
            {mine && (
              <button className="primary" onClick={() => setAdd(true)}>
                <Plus size={17} />
                {tab === "products" ? t("发布产品") : t("发起讨论")}
              </button>
            )}
          </div>
          {feed.error ? (
            <Notice>{feed.error}</Notice>
          ) : feed.loading ? (
            <Loading />
          ) : !feed.data?.items.length ? (
            <Empty>
              {tab === "products" ? t("还没有公开产品") : t("还没有发起讨论")}
            </Empty>
          ) : (
            <div
              className={
                tab === "products"
                  ? "creator-product-grid"
                  : "community-discussions"
              }
            >
              {feed.data.items.map((item) =>
                tab === "products" ? (
                  <ProductCard product={item as CreatorProduct} key={item.id} />
                ) : (
                  <PostRow item={item as CommunityPost} key={item.id} />
                ),
              )}
            </div>
          )}
          <Pager
            page={page}
            hasMore={Boolean(feed.data?.hasMore)}
            onPage={setPage}
          />
        </>
      )}
      {edit && (
        <ProfileEditor
          profile={p}
          onClose={() => setEdit(false)}
          onSaved={() => {
            setEdit(false);
            void profile.refresh();
          }}
        />
      )}
      {add &&
        (tab === "products" ? (
          <ProductEditor
            onClose={() => setAdd(false)}
            onSaved={() => {
              setAdd(false);
              void feed.refresh();
            }}
          />
        ) : (
          <PostEditor
            onClose={() => setAdd(false)}
            onSaved={() => {
              setAdd(false);
              void feed.refresh();
            }}
          />
        ))}
    </>
  );
}
function CreatorDirectory() {
  const [query, setQuery] = useState({ q: "", school: "" }),
    [page, setPage] = useState(1);
  const load = useLoad<CommunityPage<CreatorProfile>>(
    `/api/community/directory?${new URLSearchParams({ ...query, page: String(page) })}`,
  );
  return (
    <>
      <div className="community-heading">
        <div>
          <span className="eyebrow">MEET THE CREATORS</span>
          <h1>{t("找到一起做事的人。")}</h1>
        </div>
      </div>
      <form
        className="community-search"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setQuery({
            q: String(f.get("q") || ""),
            school: String(f.get("school") || ""),
          });
          setPage(1);
        }}
      >
        <Search size={19} />
        <input
          name="q"
          aria-label={t("搜索创作者")}
          placeholder={t("名称、简介或标签")}
          maxLength={100}
        />
        <input
          name="school"
          aria-label={t("按学校筛选")}
          placeholder={t("学校")}
          maxLength={100}
        />
        <button>{t("搜索")}</button>
      </form>
      {load.error ? (
        <Notice>{load.error}</Notice>
      ) : load.loading ? (
        <Loading />
      ) : !load.data?.items.length ? (
        <Empty>{t("没有找到匹配的公开主页")}</Empty>
      ) : (
        <div className="creator-product-grid">
          {load.data.items.map((p) => (
            <article className="creator-product-card" key={p.id}>
              <Author id={p.id} name={p.display_name} school={p.school} />
              <p>{p.bio.slice(0, 180)}</p>
              <Tags values={p.tags} />
              <Link to={`/creators/${p.id}`}>
                {t("查看主页")}
                <ArrowUpRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      )}
      <Pager
        page={page}
        hasMore={Boolean(load.data?.hasMore)}
        onPage={setPage}
      />
    </>
  );
}
export function CommunityPreview({ moduleId }: { moduleId: string }) {
  const [reply, setReply] = useState(""),
    [items, setItems] = useState<string[]>([]),
    [name, setName] = useState("林同学"),
    [school, setSchool] = useState("我的大学"),
    [query, setQuery] = useState("");
  return (
    <div className="community-preview">
      <Notice kind="info">{t("交互示例，内容仅保留在当前预览中。")}</Notice>
      {moduleId === "member-directory" ? (
        <>
          <div className="community-search">
            <Search size={19} />
            <input
              aria-label={t("搜索示例成员")}
              placeholder={t("名称、学校或标签")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="community-demo-directory">
            {[
              {
                name: "林同学",
                school: "示例大学 A",
                bio: "正在开发校园二手交易平台。",
                tags: ["交易市场", "产品设计"],
              },
              {
                name: "陈同学",
                school: "示例大学 B",
                bio: "为学生摄影师做预约和作品展示。",
                tags: ["摄影", "服务预约"],
              },
            ]
              .filter((person) =>
                `${person.name} ${person.school} ${person.bio} ${person.tags.join(" ")}`.includes(
                  query.trim(),
                ),
              )
              .map((person) => (
                <article className="community-post-row" key={person.name}>
                  <h3>{person.name}</h3>
                  <span>
                    {person.school}
                    {t("· 本人填写")}
                  </span>
                  <p>{person.bio}</p>
                  <Tags values={person.tags} />
                </article>
              ))}
          </div>
        </>
      ) : moduleId === "discussion-forum" ? (
        <>
          <article className="community-post-row">
            <span className="eyebrow">{t("寻找合作")}</span>
            <h2>{t("一起做一个校园二手循环平台")}</h2>
            <p>
              {t("想找对产品设计和校园运营感兴趣的同学，一起把第一版做出来。")}
            </p>
            <Tags values={["校园创业", "交易市场"]} />
          </article>
          {items.map((r, i) => (
            <p className="community-reply" key={i}>
              {r}
            </p>
          ))}
          <form
            className="commerce-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (reply.trim()) {
                setItems([...items, reply]);
                setReply("");
              }
            }}
          >
            <label>
              {t("回复")}
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                maxLength={3000}
                required
              />
            </label>
            <button>
              <Send size={17} />
              {t("发布示例回复")}
            </button>
          </form>
        </>
      ) : moduleId === "product-showcase" ? (
        <article className="creator-product-card">
          <div className="product-mark">
            <Store size={28} />
            <span>{t("交易市场")}</span>
          </div>
          <h2>{t("校园好物循环")}</h2>
          <p>{t("闲置教材与原创手作的校园市集。")}</p>
          <Tags values={["二手交易", "校园创业"]} />
          <span className="badge">{t("内测中")}</span>
        </article>
      ) : (
        <>
          <div className="creator-profile">
            <div className="creator-monogram">{name.slice(0, 1)}</div>
            <div>
              <h2>{name}</h2>
              <p>
                {school}
                {t("· 本人填写")}
              </p>
              <Tags values={["独立开发", "产品设计"]} />
            </div>
          </div>
          <div className="commerce-form">
            <label>
              {t("公开名称")}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
            </label>
            <label>
              {t("学校")}
              <input
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                maxLength={100}
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}
function ProductDetail({ user }: { user: User }) {
  const { id } = useParams(),
    data = useLoad<{ product: CreatorProduct }>(
      `/api/community/products/${id}`,
    ),
    [edit, setEdit] = useState(false),
    navigate = useNavigate();
  if (data.error) return <Notice>{data.error}</Notice>;
  if (!data.data) return <Loading />;
  const p = data.data.product;
  return (
    <>
      <Link className="back-link" to="/community/products">
        <ArrowLeft size={16} />
        {t("产品广场")}
      </Link>
      <article className="community-detail">
        <div className="product-mark">
          <Store size={34} />
          <span>{t(p.category)}</span>
          <span className="badge">{t(p.stage)}</span>
        </div>
        <h1>{p.name}</h1>
        <p className="detail-tagline">{p.tagline}</p>
        <Author id={p.owner_id} name={p.author_name} school={p.school} />
        <Tags values={p.tags} />
        <div className="community-prose preserve-lines">{p.description}</div>
        <div className="inline-actions">
          {p.url && (
            <a
              className="button primary"
              href={p.url}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
            >
              {t("访问产品")}
              <ArrowUpRight size={18} />
            </a>
          )}
          {user?.id === p.owner_id && (
            <button onClick={() => setEdit(true)}>
              <Pencil size={17} />
              {t("编辑产品")}
            </button>
          )}
          {(user?.id === p.owner_id || user?.role === "admin") && (
            <DeleteButton
              url={`/api/community/products/${id}`}
              onDeleted={() => navigate(`/creators/${p.owner_id}`)}
            />
          )}
        </div>
      </article>
      {edit && (
        <ProductEditor
          product={p}
          onClose={() => setEdit(false)}
          onSaved={() => {
            setEdit(false);
            void data.refresh();
          }}
        />
      )}
    </>
  );
}
function PostDetail({ user }: { user: User }) {
  const { id } = useParams(),
    data = useLoad<{ post: CommunityPost }>(`/api/community/posts/${id}`),
    [page, setPage] = useState(1),
    replies = useLoad<CommunityPage<CommunityReply>>(
      `/api/community/posts/${id}/replies?page=${page}`,
    ),
    [edit, setEdit] = useState(false),
    navigate = useNavigate(),
    action = useAction();
  if (data.error) return <Notice>{data.error}</Notice>;
  if (!data.data) return <Loading />;
  const p = data.data.post;
  return (
    <>
      <Link className="back-link" to="/community">
        <ArrowLeft size={16} />
        {t("创作者论坛")}
      </Link>
      <article className="community-detail">
        <div className="post-meta">
          <span>{t(p.category)}</span>
          <time>{date(p.created_at)}</time>
        </div>
        <h1>{p.title}</h1>
        <Author id={p.author_id} name={p.author_name} school={p.school} />
        <Tags values={p.tags} />
        <div className="community-prose preserve-lines">{p.body}</div>
        <div className="inline-actions">
          {user?.id === p.author_id && (
            <button onClick={() => setEdit(true)}>
              <Pencil size={17} />
              {t("编辑讨论")}
            </button>
          )}
          {(user?.id === p.author_id || user?.role === "admin") && (
            <DeleteButton
              url={`/api/community/posts/${id}`}
              onDeleted={() => navigate("/community")}
            />
          )}
        </div>
        <section className="community-replies">
          <h2>{t("交流与回复")}</h2>
          {action.error && <Notice>{action.error}</Notice>}
          {user ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                void action.run(async () => {
                  await post(
                    `/api/community/posts/${id}/replies`,
                    Object.fromEntries(new FormData(form)),
                  );
                  form.reset();
                  await replies.refresh();
                }, "回复已发布");
              }}
            >
              <label>
                {t("你的回复")}
                <textarea name="body" required maxLength={3000} rows={3} />
              </label>
              <button className="primary" disabled={action.busy}>
                <Send size={17} />
                {t("发布回复")}
              </button>
            </form>
          ) : (
            <Link to="/login" className="button">
              {t("登录后参与讨论")}
            </Link>
          )}
          {action.message && <Notice kind="success">{action.message}</Notice>}
          {replies.error && <Notice>{replies.error}</Notice>}
          {replies.data?.items.map((r) => (
            <article key={r.id} className="community-reply">
              <div className="section-head">
                <Author id={r.author_id} name={r.author_name} />
                <div className="inline-actions">
                  <time>{date(r.created_at)}</time>
                  {(user?.id === r.author_id || user?.role === "admin") && (
                    <DeleteButton
                      url={`/api/community/replies/${r.id}`}
                      onDeleted={() => void replies.refresh()}
                    />
                  )}
                </div>
              </div>
              <p className="preserve-lines">{r.body}</p>
            </article>
          ))}
          <Pager
            page={page}
            hasMore={Boolean(replies.data?.hasMore)}
            onPage={setPage}
          />
        </section>
      </article>
      {edit && (
        <PostEditor
          item={p}
          onClose={() => setEdit(false)}
          onSaved={() => {
            setEdit(false);
            void data.refresh();
          }}
        />
      )}
    </>
  );
}
function Editor({
  title,
  children,
  onClose,
  onSubmit,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
}) {
  const action = useAction();
  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="community-editor"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const values = new FormData(e.currentTarget);
          void action.run(() => onSubmit(values));
        }}
      >
        {children}
        {action.error && <Notice>{action.error}</Notice>}
        <button className="primary" disabled={action.busy}>
          <CheckIcon />
          {action.busy ? t("正在保存") : t("保存并公开")}
        </button>
      </form>
    </Modal>
  );
}
function CheckIcon() {
  return <ArrowUpRight size={17} />;
}
function ProfileEditor({
  profile: p,
  onClose,
  onSaved,
}: {
  profile: CreatorProfile;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Editor
      title={t("编辑创作者主页")}
      onClose={onClose}
      onSubmit={async (f) => {
        await api("/api/community/profile", {
          method: "PUT",
          body: JSON.stringify({
            ...Object.fromEntries(f),
            tags: parseTags(String(f.get("tags"))),
          }),
        });
        onSaved();
      }}
    >
      <label>
        {t("公开名称")}
        <input
          name="displayName"
          defaultValue={p.display_name}
          required
          maxLength={80}
        />
      </label>
      <label>
        {t("学校（选填）")}
        <input name="school" defaultValue={p.school} maxLength={100} />
      </label>
      <label>
        {t("个人简介")}
        <textarea name="bio" defaultValue={p.bio} rows={4} maxLength={1200} />
      </label>
      <label>
        {t("标签（最多 8 个，用逗号分隔）")}
        <input
          name="tags"
          defaultValue={p.tags.join(", ")}
          maxLength={167}
          placeholder={t("独立开发, 校园创业, 产品设计")}
        />
      </label>
    </Editor>
  );
}
function ProductEditor({
  product: p,
  onClose,
  onSaved,
}: {
  product?: CreatorProduct;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Editor
      title={p ? t("编辑产品") : t("发布产品")}
      onClose={onClose}
      onSubmit={async (f) => {
        await api(`/api/community/products${p ? `/${p.id}` : ""}`, {
          method: p ? "PUT" : "POST",
          body: JSON.stringify({
            ...Object.fromEntries(f),
            tags: parseTags(String(f.get("tags"))),
          }),
        });
        onSaved();
      }}
    >
      <label>
        {t("产品名称")}
        <input name="name" defaultValue={p?.name} required maxLength={80} />
      </label>
      <label>
        {t("一句话介绍")}
        <input
          name="tagline"
          defaultValue={p?.tagline}
          required
          maxLength={160}
        />
      </label>
      <div className="form-grid">
        <label>
          {t("领域")}
          <select name="category" defaultValue={p?.category}>
            {productCategories.map((c) => (
              <option key={c} value={c}>
                {t(c)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("当前阶段")}
          <select name="stage" defaultValue={p?.stage || "构建中"}>
            {["构建中", "内测中", "已发布"].map((s) => (
              <option key={s} value={s}>
                {t(s)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        {t("产品简介")}
        <textarea
          name="description"
          defaultValue={p?.description}
          rows={5}
          required
          maxLength={5000}
        />
      </label>
      <label>
        {t("访问地址（选填）")}
        <input
          name="url"
          type="url"
          defaultValue={p?.url}
          maxLength={2048}
          placeholder="https://"
        />
      </label>
      <label>
        {t("标签（最多 8 个，用逗号分隔）")}
        <input name="tags" defaultValue={p?.tags.join(", ")} maxLength={167} />
      </label>
    </Editor>
  );
}
function PostEditor({
  item: p,
  onClose,
  onSaved,
}: {
  item?: CommunityPost;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Editor
      title={p ? t("编辑讨论") : t("发起讨论")}
      onClose={onClose}
      onSubmit={async (f) => {
        await api(`/api/community/posts${p ? `/${p.id}` : ""}`, {
          method: p ? "PUT" : "POST",
          body: JSON.stringify({
            ...Object.fromEntries(f),
            tags: parseTags(String(f.get("tags"))),
          }),
        });
        onSaved();
      }}
    >
      <label>
        {t("标题")}
        <input
          name="title"
          defaultValue={p?.title}
          required
          minLength={2}
          maxLength={160}
        />
      </label>
      <label>
        {t("话题")}
        <select name="category" defaultValue={p?.category || "经验交流"}>
          {postCategories.map((c) => (
            <option key={c} value={c}>
              {t(c)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("内容")}
        <textarea
          name="body"
          defaultValue={p?.body}
          rows={8}
          required
          minLength={2}
          maxLength={10000}
        />
      </label>
      <label>
        {t("标签（最多 8 个，用逗号分隔）")}
        <input name="tags" defaultValue={p?.tags.join(", ")} maxLength={167} />
      </label>
    </Editor>
  );
}
