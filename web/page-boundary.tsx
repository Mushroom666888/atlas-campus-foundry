import { Component, type ReactNode } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";

export class PageBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="page-recovery">
        <a className="atlas-logo" href="/">
          atlas
        </a>
        <h1>这个页面暂时无法打开</h1>
        <p>你的项目仍然保存在工作台。可以重新加载，或返回首页。</p>
        <div className="inline-actions">
          <button className="primary" onClick={() => window.location.reload()}>
            <RefreshCw size={18} />
            重新加载
          </button>
          <a className="button" href="/">
            <ArrowLeft size={18} />
            返回首页
          </a>
        </div>
      </main>
    );
  }
}
