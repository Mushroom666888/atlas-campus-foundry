import {
  moduleManifestSchema,
  type ModuleField,
} from "../../contracts/src/index.js";
const field = (
  key: string,
  label: string,
  type: ModuleField["type"] = "text",
  options?: string[],
): ModuleField => ({ key, label, type, required: true, options });
export const connectorDefinitions = [
  {
    id: "when-created",
    name: "记录创建触发",
    description: "只让新建记录事件进入下游节点。",
    fields: [],
  },
  {
    id: "when-updated",
    name: "记录更新触发",
    description: "只让记录编辑和状态变更事件进入下游。",
    fields: [],
  },
  {
    id: "when-archived",
    name: "记录归档触发",
    description: "只让软归档事件进入下游。",
    fields: [],
  },
  {
    id: "status-condition",
    name: "状态条件",
    description: "匹配指定状态后继续执行。",
    fields: [field("value", "匹配状态")],
  },
  {
    id: "keyword-condition",
    name: "关键词条件",
    description: "检查标题或指定字段是否包含关键词。",
    fields: [
      field("field", "字段", "select", ["title", "status", "text"]),
      field("value", "关键词"),
    ],
  },
  {
    id: "number-condition",
    name: "数值条件",
    description: "比较一个数值字段与设定阈值。",
    fields: [
      field("field", "字段键"),
      field("operator", "比较方式", "select", [">=", "<=", "="]),
      field("value", "阈值", "number"),
    ],
  },
  {
    id: "field-map",
    name: "字段映射",
    description: "把一个输入字段映射为下游可用的字段。",
    fields: [field("from", "来源字段"), field("to", "目标字段")],
  },
  {
    id: "text-template",
    name: "文本模板",
    description:
      "用记录字段生成下游动作的文字，支持 {title}、{status} 和 {data.字段}。",
    fields: [field("template", "文字模板", "textarea")],
  },
  {
    id: "notify-author",
    name: "通知操作者",
    description: "向当前操作账号的真实站内收件箱写入通知。",
    fields: [],
    dependencies: { notifications: "^1.0.0" },
  },
  {
    id: "create-linked-record",
    name: "创建关联记录",
    description:
      "在选定业务模块写入当前账号拥有的关联记录；目标字段必须通过校验。",
    fields: [field("targetModule", "目标模块 ID"), field("title", "标题模板")],
  },
  {
    id: "audit-entry",
    name: "活动留痕",
    description:
      "把通过条件的事件写入应用 domain_events，保留节点和来源记录 ID。",
    fields: [],
  },
  {
    id: "unique-record",
    name: "同名去重",
    description:
      "本模块存在同账号的其他同名记录时，阻止下游动作；不删除原记录。",
    fields: [],
  },
] as const;
export const presentationDefinitions = [
  [
    "card-view",
    "卡片视图",
    "把相连模块的真实记录显示为可打开的卡片。",
    "LayoutGrid",
  ],
  ["table-view", "表格视图", "把记录字段和状态显示为紧凑表格。", "Table2"],
  [
    "board-view",
    "状态看板",
    "按业务状态分列，可通过状态操作移动记录。",
    "Kanban",
  ],
  ["metric-counter", "记录计数", "显示当前检索范围的真实记录总数。", "Hash"],
  [
    "status-summary",
    "状态汇总",
    "按状态显示真实记录数量分布。",
    "ChartNoAxesColumn",
  ],
  [
    "keyword-search",
    "关键词搜索框",
    "对相连模块的标题和业务字段执行后端检索。",
    "Search",
  ],
  ["status-picker", "状态筛选器", "通过业务状态筛选后端记录。", "ListFilter"],
  [
    "embedded-list",
    "内嵌记录区",
    "在父记录详情中展示并创建带关联关系的子模块记录。",
    "PanelsTopLeft",
  ],
] as const;
export const connectionCatalog = [
  ...connectorDefinitions.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    category: "connector" as const,
    icon: "Workflow",
    fields: [...d.fields],
    dependencies: "dependencies" in d ? d.dependencies : {},
  })),
  ...presentationDefinitions.map(([id, name, description, icon]) => ({
    id,
    name,
    description,
    category: "presentation" as const,
    icon,
    fields:
      id === "embedded-list"
        ? [field("childModule", "内嵌业务模块 ID")]
        : ([] as ModuleField[]),
    dependencies: {},
  })),
].map((d) =>
  moduleManifestSchema.parse({
    moduleId: d.id,
    name: d.name,
    description: d.description,
    category: d.category,
    icon: d.icon,
    aliases: [d.name],
    tags: [
      d.category === "connector" ? "连接自动化" : "界面展示",
      "可视化编排",
    ],
    version: "1.0.0",
    capabilities: [d.id],
    configurationFields: d.fields,
    configurationSchema: {
      type: "object",
      properties: Object.fromEntries(
        d.fields.map((f) => [
          f.key,
          { type: f.type === "number" ? "number" : "string" },
        ]),
      ),
      required: d.fields.filter((f) => f.required).map((f) => f.key),
    },
    providedInterfaces: [
      d.category === "connector" ? "campus.flow@1" : "campus.view@1",
    ],
    requiredInterfaces: Object.keys(d.dependencies).map(
      (id) => `campus.${id}@1`,
    ),
    dependencies: d.dependencies,
    databaseMigrations: [],
    requiredPermissions:
      d.id === "notify-author"
        ? ["notifications:own"]
        : d.id === "create-linked-record"
          ? ["records:own"]
          : [],
    eventsProduced: [],
    eventsConsumed: d.category === "connector" ? ["records.changed"] : [],
    frontendExports: [`Composition/${d.id}`],
    backendExports: d.category === "connector" ? [`Flow/${d.id}`] : [],
    healthChecks: ["/api/health"],
    testSpecifications: [
      "tests/business.test.ts",
      "tests/modules.browser.spec.ts",
    ],
    compatiblePlatformVersions: "^0.1.0",
    securityMetadata: {
      review: "platform",
      execution: "declarative",
      network: [],
    },
    license: "MIT",
  }),
);
