import { t } from "./i18n";
import { useEffect, useState } from "react";
import type {
  ModuleManifest,
  RecordDefinition,
} from "../packages/contracts/src/index";
import { RecordModule } from "./record-module";
import { Notice } from "./components";

const definitions: Record<string, RecordDefinition> = {
  events: {
    titleLabel: "活动名称",
    fields: [
      { key: "startsAt", label: "活动日期", type: "date", required: true },
      {
        key: "capacity",
        label: "人数上限",
        type: "number",
        required: true,
        min: 1,
        max: 100000,
      },
      {
        key: "description",
        label: "活动介绍",
        type: "textarea",
        required: false,
      },
    ],
    statuses: ["开放报名", "已结束"],
    visibility: "application",
    view: "cards",
  },
  groups: {
    titleLabel: "小组名称",
    fields: [
      { key: "course", label: "课程或主题", type: "text", required: true },
      {
        key: "capacity",
        label: "人数上限",
        type: "number",
        required: true,
        min: 1,
        max: 100000,
      },
    ],
    statuses: ["开放加入", "已关闭"],
    visibility: "application",
    view: "cards",
  },
  profiles: {
    titleLabel: "称呼",
    fields: [
      { key: "major", label: "专业", type: "text", required: true },
      { key: "courses", label: "课程", type: "text", required: false },
      { key: "bio", label: "个人介绍", type: "textarea", required: false },
    ],
    statuses: ["公开", "私密"],
    visibility: "owner",
    view: "cards",
  },
  content: {
    titleLabel: "标题",
    fields: [
      { key: "description", label: "正文", type: "textarea", required: true },
      { key: "topic", label: "主题", type: "text", required: false },
    ],
    statuses: ["发布中", "已关闭"],
    visibility: "application",
    view: "cards",
  },
  search: {
    titleLabel: "标题",
    fields: [
      { key: "description", label: "内容", type: "textarea", required: true },
    ],
    statuses: ["公开", "已关闭"],
    visibility: "application",
    view: "table",
  },
};
export function FoundationPreview({ module }: { module: ModuleManifest }) {
  const [image, setImage] = useState<File | null>(null),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const [latitude, setLatitude] = useState(""),
    [longitude, setLongitude] = useState("");
  useEffect(() => {
    if (!image) {
      setUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(image);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);
  if (definitions[module.moduleId])
    return (
      <RecordModule
        module={{ ...module, recordDefinition: definitions[module.moduleId] }}
        preview
      />
    );
  if (module.moduleId === "media")
    return (
      <div className="capability-preview">
        <small>{t("本地图片预览，未上传到服务器")}</small>
        <h2>{t("图片与媒体")}</h2>
        <label>
          {t("选择图片")}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (
                !["image/png", "image/jpeg", "image/webp"].includes(
                  file.type,
                ) ||
                file.size > 5_000_000
              ) {
                setError("请选择 5 MB 以内的 PNG、JPEG 或 WebP 图片");
                return;
              }
              setError("");
              setImage(file);
            }}
          />
        </label>
        {error && <Notice>{error}</Notice>}
        {url && (
          <figure className="media-preview">
            <img src={url} alt={image!.name} />
            <figcaption>
              {image!.name} · {(image!.size / 1024).toFixed(1)} KB
            </figcaption>
          </figure>
        )}
      </div>
    );
  return (
    <div className="capability-preview">
      <small>{t("地图预览采用你输入的坐标，不包含预置校园地点")}</small>
      <h2>{t("校园地点")}</h2>
      <ol className="campus-contract-chain" aria-label={t("校园数据关系")}>
        {["学校", "校区", "建筑", "场地", "活动"].map((name) => (
          <li key={name}>{t(name)}</li>
        ))}
      </ol>
      <label>
        {t("纬度")}
        <input
          type="number"
          min={-90}
          max={90}
          step="any"
          value={latitude}
          onChange={(e) => setLatitude(e.target.value)}
        />
      </label>
      <label>
        {t("经度")}
        <input
          type="number"
          min={-180}
          max={180}
          step="any"
          value={longitude}
          onChange={(e) => setLongitude(e.target.value)}
        />
      </label>
      {latitude &&
      longitude &&
      Math.abs(Number(latitude)) <= 90 &&
      Math.abs(Number(longitude)) <= 180 ? (
        <a
          className="button"
          href={`https://www.openstreetmap.org/?mlat=${Number(latitude)}&mlon=${Number(longitude)}#map=16/${Number(latitude)}/${Number(longitude)}`}
          target="_blank"
          rel="noreferrer"
        >
          {t("在 OpenStreetMap 查看地点")}
        </a>
      ) : (
        <p className="muted">{t("输入有效经纬度后查看地图。")}</p>
      )}
    </div>
  );
}
