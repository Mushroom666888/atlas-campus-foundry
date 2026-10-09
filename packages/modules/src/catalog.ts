import semver from 'semver';
import { AppError, moduleManifestSchema, type ModuleManifest } from '../../contracts/src/index.js';

const definitions = [
  ['identity', '身份与账户', 'foundation', '邮箱账户、会话及应用内角色', []],
  ['profiles', '学生档案', 'campus', '应用内资料、课程与学习兴趣', ['identity']],
  ['campus', '学校与地点', 'campus', '学校、校区与用户明确提供的真实地点', ['identity']],
  ['content', '内容发布', 'foundation', '帖子、商品与状态管理', ['identity']],
  ['search', '搜索与筛选', 'foundation', '持久化内容的参数化全文关键词筛选', ['content']],
  ['chat', '实时聊天', 'foundation', '参与者私聊与群聊，持久化消息和事件流', ['identity']],
  ['notifications', '站内通知', 'foundation', '持久化收件箱与已读状态', ['identity']],
  ['events', '活动与报名', 'scenario', '活动发布、报名、容量检查与通知', ['content', 'campus', 'notifications']],
  ['groups', '学习小组与社团', 'campus', '课程、小组与成员关系', ['profiles', 'chat', 'content']],
  ['media', '图片与媒体', 'foundation', '限额图片上传与受控文件读取', ['identity']]
] as const;
export const catalog: ModuleManifest[] = definitions.map(([moduleId, name, category, description, dependencies]) => moduleManifestSchema.parse({
  moduleId, name, category, description, version: '1.0.0', capabilities: [moduleId],
  configurationSchema: { type: 'object', properties: {}, additionalProperties: false },
  providedInterfaces: [`campus.${moduleId}@1`], requiredInterfaces: dependencies.map(d => `campus.${d}@1`),
  dependencies: Object.fromEntries(dependencies.map(d => [d, '^1.0.0'])),
  databaseMigrations: ['runtime/001_initial.sql'], requiredPermissions: [`${moduleId}:own`],
  eventsProduced: [`${moduleId}.changed`], eventsConsumed: [],
  frontendExports: [`CampusApplication/${moduleId}`], backendExports: [`runtime/${moduleId}`],
  healthChecks: ['/api/health'], testSpecifications: ['tests/runtime.test.ts', 'tests/browser.spec.ts'],
  compatiblePlatformVersions: '^0.1.0', securityMetadata: { review: 'platform', execution: 'declarative', network: [] }, license: 'MIT'
}));
export function resolveModules(requested: string[], available: ModuleManifest[] = catalog, pins: Record<string,string> = {}) {
  let attempts=0;
  const solve=(selected:Map<string,ModuleManifest>,constraints:Map<string,string[]>):Map<string,ModuleManifest>|null=>{
    if(++attempts>5000)throw new AppError(422,'RESOLUTION_BUDGET','Dependency resolution budget exceeded');
    for(const [id,m] of selected)if(!(constraints.get(id)??[]).every(r=>semver.satisfies(m.version,r)))return null;
    const next=[...constraints.keys()].sort().find(id=>!selected.has(id));if(!next)return selected;
    const candidates=available.filter(m=>m.moduleId===next&&m.securityMetadata.review!=='pending'&&semver.satisfies('0.1.0',m.compatiblePlatformVersions)&&(constraints.get(next)??[]).every(r=>semver.satisfies(m.version,r))&&semver.satisfies(m.version,pins[next]??'*')).sort((a,b)=>semver.rcompare(a.version,b.version));
    for(const candidate of candidates){const chosen=new Map(selected);chosen.set(next,candidate);const required=new Map([...constraints].map(([id,ranges])=>[id,[...ranges]]));for(const [dependency,range] of Object.entries(candidate.dependencies))required.set(dependency,[...(required.get(dependency)??[]),range]);const result=solve(chosen,required);if(result)return result;}
    return null;
  };
  const selected=solve(new Map(),new Map(requested.map(id=>[id,['*']])));if(!selected)throw new AppError(422,'MODULE_UNAVAILABLE','No compatible approved module version satisfies all constraints');
  const ordered:ModuleManifest[]=[],visiting=new Set<string>(),done=new Set<string>();
  const visit=(id:string)=>{if(visiting.has(id))throw new AppError(409,'DEPENDENCY_CYCLE',`Cycle at ${id}`);if(done.has(id))return;visiting.add(id);const m=selected.get(id)!;for(const dependency of Object.keys(m.dependencies))visit(dependency);visiting.delete(id);done.add(id);ordered.push(m);};
  for(const id of [...selected.keys()].sort())visit(id);return ordered;
}
