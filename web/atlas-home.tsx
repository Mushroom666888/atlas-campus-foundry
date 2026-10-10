import { t, LanguageSelect } from "./i18n";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Menu, MoveUpRight, X } from "lucide-react";
import type { PublicUser } from "../packages/contracts/src/index";
export function AtlasHome({ user }: { user: PublicUser | null }) {
  const [open, setOpen] = useState(false);
  const scene = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = scene.current;
    if (!element) return;
    let visible = true;
    const update = () =>
      element.style.setProperty(
        "--scene-play",
        visible && !document.hidden ? "running" : "paused",
      );
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
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
        {t("跳到主要内容")}
      </a>
      <main className="atlas-hero" ref={scene}>
        <div className="atlas-grid" aria-hidden="true" />
        <header className="atlas-nav">
          <Link to="/" className="atlas-logo" aria-label={t("Atlas 首页")}>
            <MoveUpRight strokeWidth={3} />
            <span>atlas</span>
          </Link>
          <nav className={open ? "is-open" : ""} aria-label={t("首页导航")}>
            <Link to="/modules" onClick={() => setOpen(false)}>
              {t("探索模块")}
            </Link>
            <Link to="/compose">{t("可视化创作")}</Link>
            <Link to="/community">{t("创作者社区")}</Link>
            <Link to="/builder">
              AI Builder <ArrowUpRight size={13} />
            </Link>
          </nav>
          <LanguageSelect />
          <Link className="atlas-nav-cta" to="/studio">
            {user ? t("进入工作台") : t("开始创作")}
            <ArrowUpRight size={17} />
          </Link>
          <button
            className="atlas-menu"
            onClick={() => setOpen(!open)}
            aria-label={open ? t("关闭菜单") : t("打开菜单")}
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </button>
        </header>
        <div className="atlas-intro" id="atlas-main">
          <span className="atlas-overline">{t("校园应用创作平台")}</span>
          <p>
            {t("让校园里的每个想法，")}
            <br />
            {t("都有自己的世界。")}
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
        <div className="atlas-hero-bottom">
          <p>
            {t("从一个灵感，")}
            <br />
            {t("到一个真正运行的应用。")}
          </p>
          <Link className="atlas-launch" to="/create">
            <span>{t("创造你的世界")}</span>
            <ArrowUpRight size={30} strokeWidth={1.5} />
          </Link>
        </div>
      </main>
      <footer className="atlas-footer">
        <Link to="/" className="atlas-logo">
          <MoveUpRight strokeWidth={3} />
          <span>atlas</span>
        </Link>
        <span>{t("校园想法，真实生长。")}</span>
        <a
          href="https://images.nasa.gov/details/carina_nebula"
          target="_blank"
          rel="noreferrer"
        >
          Cosmic Cliffs · NASA / ESA / CSA / STScI <ArrowUpRight size={12} />
        </a>
        <Link to="/studio">
          {t("进入工作台")}
          <ArrowUpRight size={16} />
        </Link>
      </footer>
    </div>
  );
}
