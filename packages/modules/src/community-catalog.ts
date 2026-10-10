import { moduleManifestSchema } from "../../contracts/src/index.js";
const definitions = [
  {
    id: "creator-profiles",
    name: "用户主页",
    description: "用户自填公开名称、学校、简介和标签，每个账号都有独立主页。",
    aliases: ["个人主页", "创作者主页"],
    deps: ["identity"],
    api: ["GET /api/community/profiles/:id", "PUT /api/community/profile"],
  },
  {
    id: "discussion-forum",
    name: "交流论坛",
    description: "按话题发帖、关键词搜索、回复交流、作者编辑与管理员删除。",
    aliases: ["论坛", "讨论区"],
    deps: ["creator-profiles"],
    api: [
      "GET /api/community/posts",
      "POST /api/community/posts",
      "GET /api/community/posts/:id/replies",
      "POST /api/community/posts/:id/replies",
    ],
  },
  {
    id: "product-showcase",
    name: "产品展示",
    description: "用户发布自己的产品、外部访问地址、介绍、阶段与分类。",
    aliases: ["产品广场", "作品集"],
    deps: ["creator-profiles"],
    api: [
      "GET /api/community/products",
      "POST /api/community/products",
      "PUT /api/community/products/:id",
    ],
  },
  {
    id: "member-directory",
    name: "用户目录",
    description:
      "搜索主动填写公开主页的成员，按学校和标签寻找合作伙伴；不暴露登录邮箱。",
    aliases: ["成员目录", "用户库"],
    deps: ["creator-profiles"],
    api: ["GET /api/community/directory"],
  },
];
export const communityCatalog = definitions.map((d) =>
  moduleManifestSchema.parse({
    moduleId: d.id,
    name: d.name,
    description: d.description,
    version: "1.0.0",
    category: "community",
    capabilities: [d.id],
    configurationSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    providedInterfaces: [`campus.${d.id}@1`],
    requiredInterfaces: d.deps.map((id) => `campus.${id}@1`),
    dependencies: Object.fromEntries(d.deps.map((id) => [id, "^1.0.0"])),
    databaseMigrations: ["runtime/004_community.sql"],
    requiredPermissions: [`${d.id}:own`],
    eventsProduced: [],
    eventsConsumed: [],
    frontendExports: [`Community/${d.id}`],
    backendExports: d.api,
    healthChecks: ["/api/health"],
    testSpecifications: [
      "tests/community.test.ts",
      "tests/community.browser.spec.ts",
    ],
    compatiblePlatformVersions: "^0.1.0",
    securityMetadata: {
      review: "platform",
      execution: "declarative",
      network: [],
    },
    license: "MIT",
    tags: ["用户社区", "产品经营"],
    aliases: d.aliases,
    icon: "Users",
  }),
);
