import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, useLocation } from "react-router-dom";
import { api } from "./api";
import { Auth, Loading, Notice } from "./components";
import { AtlasHome } from "./atlas-home";
import { PageBoundary } from "./page-boundary";
const Studio = lazy(() =>
  import("./studio").then((m) => ({ default: m.Studio })),
);
const CampusApplication = lazy(() =>
  import("./runtime").then((m) => ({ default: m.CampusApplication })),
);
import type {
  PublicUser,
  ProductSpec,
  FeatureRecipe,
} from "../packages/contracts/src/index";
import "./styles.css";
import "./module-studio.css";
import "./atlas.css";

export type RuntimeInfo = {
  appId: string;
  spec: ProductSpec;
  modules: string[];
  recipes: FeatureRecipe[];
  emailProvider: string;
};
function Root() {
  const location = useLocation();
  const [user, setUser] = useState<PublicUser | null>(null),
    [runtime, setRuntime] = useState<RuntimeInfo | null>(null),
    [control, setControl] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    void (async () => {
      try {
        const health = await api<{ service?: string }>("/api/health");
        if (!health.service)
          setRuntime(await api<RuntimeInfo>("/api/application"));
        else setControl(true);
        setUser((await api<{ user: PublicUser | null }>("/api/auth/me")).user);
        setReady(true);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);
  if (control && location.pathname === "/") return <AtlasHome user={user} />;
  if (error)
    return (
      <main className="page-recovery">
        <h1>暂时无法连接工作台</h1>
        <Notice>{error}</Notice>
        <button onClick={() => window.location.reload()}>重新连接</button>
        <a className="button" href="/">
          返回首页
        </a>
      </main>
    );
  if (!ready) return <Loading />;
  if (!runtime && location.pathname === "/") return <AtlasHome user={user} />;
  if (!runtime && user && location.pathname === "/login")
    return <Navigate to="/studio" replace />;
  if (!user)
    return (
      <Auth
        onUser={setUser}
        title={runtime?.spec.name}
        runtime={Boolean(runtime)}
      />
    );
  return runtime ? (
    <CampusApplication
      info={runtime}
      user={user}
      onLogout={() => setUser(null)}
    />
  ) : (
    <Studio user={user} onLogout={() => setUser(null)} />
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <PageBoundary>
        <Suspense fallback={<Loading />}>
          <Root />
        </Suspense>
      </PageBoundary>
    </BrowserRouter>
  </React.StrictMode>,
);
