import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Box,
  GitBranch,
  Layers3,
  Menu,
  MoveUpRight,
  Orbit,
  X,
} from "lucide-react";
import type { PublicUser } from "../packages/contracts/src/index";

// Build-time projection keeps module contracts and validators out of the homepage.
declare const __ATLAS_CATALOG__: {
  moduleId: string;
  name: string;
  category: string;
}[];
const catalog = __ATLAS_CATALOG__;

const layers = [
  {
    id: "foundation",
    name: "基础能力",
    english: "THE FOUNDATION",
    description: "身份、数据、沟通。每一个产品的起点。",
    icon: Box,
  },
  {
    id: "campus",
    name: "校园功能",
    english: "CAMPUS POSSIBILITIES",
    description: "从课程到社团，从学习到生活。为校园而生。",
    icon: Layers3,
  },
  {
    id: "connector",
    name: "连接自动化",
    english: "MAKE THE CONNECTION",
    description: "让事件触发行动，让独立功能彼此协作。",
    icon: GitBranch,
  },
  {
    id: "presentation",
    name: "展示组件",
    english: "GIVE IT FORM",
    description: "为数据选择合适的视图，组合产品的面貌。",
    icon: Orbit,
  },
];
export function AtlasHome({ user }: { user: PublicUser | null }) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState("foundation");
  const scene = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
      fine = matchMedia("(hover: hover) and (pointer: fine)");
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (reduced.matches || !fine.matches || !scene.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        scene.current?.style.setProperty(
          "--drift-x",
          `${(event.clientX / innerWidth - 0.5) * 13}px`,
        );
        scene.current?.style.setProperty(
          "--drift-y",
          `${(event.clientY / innerHeight - 0.5) * 9}px`,
        );
      });
    };
    window.addEventListener("pointermove", move);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
    };
  }, []);
  return (
    <div className="atlas-home">
      <a className="atlas-skip" href="#atlas-main">
        跳到主要内容
      </a>
      <section className="atlas-hero" ref={scene}>
        <div className="atlas-grid" aria-hidden="true" />
        <header className="atlas-nav">
          <Link to="/" className="atlas-logo" aria-label="Atlas 首页">
            <MoveUpRight strokeWidth={3} />
            <span>atlas</span>
          </Link>
          <nav className={open ? "is-open" : ""} aria-label="首页导航">
            <a href="#atlas-modules" onClick={() => setOpen(false)}>
              模块宇宙
            </a>
            <Link to="/compose">可视化创作</Link>
            <Link to="/builder">
              AI Builder <ArrowUpRight size={13} />
            </Link>
          </nav>
          <Link className="atlas-nav-cta" to="/studio">
            {user ? "进入工作台" : "开始创作"}
            <ArrowUpRight size={17} />
          </Link>
          <button
            className="atlas-menu"
            onClick={() => setOpen(!open)}
            aria-label={open ? "关闭菜单" : "打开菜单"}
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </button>
        </header>
        <div className="atlas-intro" id="atlas-main">
          <span className="atlas-overline">CAMPUS IDEAS. REAL PRODUCTS.</span>
          <p>
            让校园里的每个想法，
            <br />
            都有自己的世界。
          </p>
        </div>
        <div className="atlas-art" aria-hidden="true">
          <picture>
            <source
              media="(max-width: 767px)"
              srcSet="/assets/atlas-cosmic-mobile.webp"
            />
            <img
              className="atlas-nebula"
              src="/assets/atlas-cosmic-cliffs.webp"
              alt=""
              fetchPriority="high"
              width="1920"
              height="1111"
            />
          </picture>
        </div>
        <h1 className="atlas-wordmark">ATLAS</h1>
        <div className="atlas-art atlas-art-front" aria-hidden="true">
          <picture>
            <source
              media="(max-width: 767px)"
              srcSet="/assets/atlas-cosmic-foreground-mobile.webp"
            />
            <img
              className="atlas-nebula"
              src="/assets/atlas-cosmic-foreground.webp"
              alt=""
              width="1920"
              height="1111"
            />
          </picture>
        </div>
        <div className="atlas-hero-bottom">
          <p>
            从一个灵感，
            <br />
            到一个真正运行的应用。
          </p>
          <Link className="atlas-launch" to="/create">
            <span>
              创造你的世界<small>START BUILDING</small>
            </span>
            <ArrowUpRight size={30} strokeWidth={1.5} />
          </Link>
          <a
            className="atlas-scroll"
            href="#atlas-modules"
            aria-label="探索模块"
          >
            <ArrowDown size={19} />
          </a>
        </div>
      </section>
      <main>
        <section className="atlas-capabilities" id="atlas-modules">
          <div className="atlas-section-heading">
            <span>从想法开始，由能力连接。</span>
            <span className="atlas-index">
              EXPLORE THE SYSTEM <ArrowDown size={15} />
            </span>
          </div>
          <div className="atlas-library-heading">
            <h2>
              小小模块。
              <br />
              <span>无限可能。</span>
            </h2>
            <div>
              <strong>
                {catalog.length}
                <span>+</span>
              </strong>
              <p>个内置模块，等待你的组合。</p>
              <Link to="/modules">
                探索全部模块 <ArrowUpRight size={19} />
              </Link>
            </div>
          </div>
          <div
            className="atlas-layer-tabs"
            role="tablist"
            aria-label="首页模块类型"
          >
            {layers.map(({ id, name, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={active === id}
                onClick={() => setActive(id)}
              >
                <Icon size={20} />
                <span>{name}</span>
                <small>
                  {catalog
                    .filter((m) => m.category === id)
                    .length.toString()
                    .padStart(2, "0")}
                </small>
              </button>
            ))}
          </div>
          <div
            className="atlas-module-spread"
            role="tabpanel"
            aria-label={layers.find((l) => l.id === active)!.name}
          >
            <div className="atlas-layer-copy">
              <span>{layers.find((l) => l.id === active)!.english}</span>
              <p>{layers.find((l) => l.id === active)!.description}</p>
              <Link to="/compose">
                自由组合 <ArrowRight size={18} />
              </Link>
            </div>
            <div className="atlas-module-list">
              {catalog
                .filter((m) => m.category === active)
                .slice(0, 6)
                .map((module) => (
                  <Link
                    key={module.moduleId}
                    to={`/modules/${module.moduleId}`}
                  >
                    <span>
                      {module.name}
                      <small>+{module.moduleId}</small>
                    </span>
                    <ArrowUpRight size={20} />
                  </Link>
                ))}
            </div>
          </div>
        </section>
        <section className="atlas-create-band">
          <div>
            <GitBranch size={37} strokeWidth={1} />
            <h2>
              连接。组合。
              <br />
              <span>让想法发生。</span>
            </h2>
          </div>
          <div>
            <p>
              为校园里的下一件小事，
              <br />
              创造一种新的可能。
            </p>
            <Link to="/compose" className="atlas-outline-cta">
              打开创作画布 <ArrowUpRight size={23} />
            </Link>
          </div>
          <span className="atlas-band-word" aria-hidden="true">
            CREATE
          </span>
        </section>
      </main>
      <footer className="atlas-footer">
        <Link to="/" className="atlas-logo">
          <MoveUpRight strokeWidth={3} />
          <span>atlas</span>
        </Link>
        <span>校园想法，真实生长。</span>
        <a
          href="https://images.nasa.gov/details/carina_nebula"
          target="_blank"
          rel="noreferrer"
        >
          Cosmic Cliffs · NASA / ESA / CSA / STScI <ArrowUpRight size={12} />
        </a>
        <Link to="/studio">
          进入工作台 <ArrowUpRight size={16} />
        </Link>
      </footer>
    </div>
  );
}
