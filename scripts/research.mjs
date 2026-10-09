import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const dir = new URL('../docs/research/', import.meta.url);
await mkdir(new URL('evidence/', dir), { recursive: true });
const queries = [
  'university campus application', 'student community platform', 'campus social network',
  'campus marketplace', 'campus second hand trading', 'university event management',
  'student club management', 'campus navigation', 'campus map', 'student matching',
  'study group application', 'campus lost found', 'university course planner',
  'student timetable', 'campus chat application', 'university forum', 'campus booking',
  'campus resource sharing', '校园 二手', '校园 活动', '校园 课表', '校园 社团',
  '"study buddy" in:name,description', '"student matching" in:name,description'
];
let prior = { queries: [], repositories: [] };
try { prior = JSON.parse(await readFile(new URL('repositories.json', dir), 'utf8')); } catch {}
const repos = new Map(prior.repositories.map(r => [r.fullName, r]));
const searches = prior.queries;
async function get(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Campus-AI-App-Foundry-Research', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}; reset=${response.headers.get('x-ratelimit-reset')}`);
  return response;
}
let excluded = prior.excluded ?? [];
async function save() { await writeFile(new URL('repositories.json', dir), JSON.stringify({ collectedAt: new Date().toISOString(), method: 'GitHub repository search; README and selected dependency files only. No claim of complete code audit.', queries: searches, excluded, repositories: [...repos.values()] }, null, 2)); }
for (const query of queries) {
  if (searches.some(s => s.query === query && s.status === 'ok')) continue;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=5`;
  try {
    const data = await (await get(url)).json();
    searches.push({ query, url, status: 'ok', totalCount: data.total_count, accessedAt: new Date().toISOString(), results: data.items.map(r => r.full_name) });
    for (const r of data.items) if (!repos.has(r.full_name)) repos.set(r.full_name, {
      fullName: r.full_name, url: r.html_url, description: r.description, stars: r.stargazers_count,
      language: r.language, defaultBranch: r.default_branch, updatedAt: r.updated_at, pushedAt: r.pushed_at,
      archived: r.archived, license: r.license?.spdx_id ?? 'UNKNOWN', topics: r.topics,
      inspection: 'METADATA_ONLY', matchedQueries: [query], evidence: [],
      reuse: r.license?.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? 'Requires license and dependency review; no code copied' : 'Reference only; no code reuse authorized'
    }); else repos.get(r.full_name).matchedQueries.push(query);
    console.log(`search ${query}: ${data.items.length}; distinct=${repos.size}`);
  } catch (error) { searches.push({ query, url, status: 'error', error: String(error), accessedAt: new Date().toISOString() }); console.error(String(error)); }
  await save();
  await delay(7000);
}
const taxonomy = {
  identity: /auth|login|登录|注册|认证/i, profile: /profile|student|学生|个人/i,
  content: /post|publish|商品|发布|帖子|论坛/i, search: /search|filter|搜索|检索|筛选/i,
  chat: /chat|messag|聊天|即时|私信/i, notifications: /notif|remind|通知|提醒/i,
  locations: /map|location|navigation|地图|地点|导航/i, events: /event|registr|活动|报名/i,
  groups: /group|club|社团|小组|组织/i, media: /upload|image|photo|图片|上传/i,
  courses: /course|timetable|schedule|课程|课表|选课/i, marketplace: /market|trading|second.hand|二手|交易/i,
  bookings: /book|reservation|预约|预订/i, lostFound: /lost|found|失物|招领/i
};
const irrelevant = /cirosantilli|cihna-dictattorshrip|gege-circle|redesigned-pancake|ENF-WHU-Dataset|Software-Testing|arcane-campus-online|linguamocha|swati1024|Aryia-Behroziuan|Learning-Management-System|Latest-Optimum-School-System|Campus-Placement-Preparation|Luo-Yihong|STPM_anomaly_detection|FTP-implement-based-on-UDP|EC2-AWS-AND-SHELL|REFILLED|ddia-study-group|clustering-modelsfor-ML|Machine-Learning-Interview|Difference-Between-AI|ReinforcementPlanner|freelancer|ANPR-Application|6S191_MIT|OxfordCodeReviewNet|JetFlix2|allProject|small-bears/;
for (const [name,r] of repos) if (irrelevant.test(name)) { excluded.push({fullName:name,url:r.url,reason:'Manual metadata screening: unrelated domain, learning material/dataset, generic school administration, or multi-project source advertisement; not a representative campus product.'}); repos.delete(name); }
await save();
for (const r of repos.values()) {
  if (r.features) continue;
  const slug = r.fullName.replaceAll('/', '__');
  let body = '';
  for (const file of ['README.md']) {
    const url = `https://api.github.com/repos/${r.fullName}/readme`;
    try {
      const payload = await (await get(url)).json();
      body = Buffer.from(payload.content ?? '', 'base64').toString('utf8').slice(0,200000);
      await writeFile(new URL(`evidence/${slug}.readme.txt`, dir), body);
      r.evidence.push({ url, file: `evidence/${slug}.readme.txt`, accessedAt: new Date().toISOString() });
      r.inspection = 'README_AND_SELECTED_FILES'; break;
    } catch (error) { r.inspectionError = String(error); }
  }
  for (const file of []) {
    const url = `https://raw.githubusercontent.com/${r.fullName}/${r.defaultBranch}/${file}`;
    try { const content = await (await get(url)).text(); await writeFile(new URL(`evidence/${slug}.${file.replaceAll('.', '_')}.txt`, dir), content); r.evidence.push({ url, file: `evidence/${slug}.${file.replaceAll('.', '_')}.txt`, accessedAt: new Date().toISOString() }); break; } catch {}
  }
  const corpus = `${r.description ?? ''}\n${body}`;
  r.features = Object.entries(taxonomy).filter(([, re]) => re.test(corpus)).map(([name]) => name);
  r.stackSignals = ['React', 'Next.js', 'Vue', 'Angular', 'Django', 'Flask', 'Spring', 'Express', 'PostgreSQL', 'MySQL', 'MongoDB', 'Firebase', 'Flutter'].filter(t => corpus.toLowerCase().includes(t.toLowerCase()));
  r.testEvidence = /pytest|jest|vitest|playwright|unit test|测试/i.test(body) ? 'README mentions tests; not executed' : 'Not established from inspected files';
  r.targetUsers = 'Inferred campus/student users from search; requires per-repository qualification';
  r.apiDesign = r.databaseEntities = r.permissionMechanism = 'Not verified by full source audit';
  await save(); console.log(`inspected ${r.fullName}: ${r.inspection}`);
}
const counts = Object.keys(taxonomy).map(f => [f, [...repos.values()].filter(r => r.features?.includes(f)).length]);
await writeFile(new URL('feature-taxonomy.md', dir), '# Feature taxonomy\n\nCounts are keyword signals in descriptions/README, not verified implementations. Sample is search-ranked, non-random and cannot establish population prevalence.\n\nFoundation: identity, content, search, chat, notifications, media.\nCampus domain: profile, locations, courses, groups.\nScenario: events, marketplace, bookings, lost/found.\n\n| Feature | Repositories with signal |\n|---|---:|\n' + counts.map(([f,n]) => `| ${f} | ${n} |`).join('\n') + '\n\n## Co-occurrence\n\n' + ['identity+events', 'chat+marketplace', 'courses+groups', 'locations+events'].map(pair => { const parts=pair.split('+'); return `- ${pair}: ${[...repos.values()].filter(r=>parts.every(p=>r.features?.includes(p))).length}`; }).join('\n'));
await writeFile(new URL('repository-analysis.md', dir), '# Repository analysis\n\nSee repositories.json for query provenance and captured evidence. Only README and selected root dependency files were inspected; no repository was fully audited or executed. Feature and stack signals are heuristic, not confirmed API/entity inventories.\n\n| Repository | Inspection | Stack signals | Feature signals | Tests |\n|---|---|---|---|---|\n' + [...repos.values()].map(r=>`| [${r.fullName}](${r.url}) | ${r.inspection} | ${r.stackSignals?.join(', ') ?? ''} | ${r.features?.join(', ') ?? ''} | ${r.testEvidence ?? 'Unknown'} |`).join('\n'));
await writeFile(new URL('licensing-audit.md', dir), '# Licensing audit\n\nGitHub SPDX metadata is a screening signal, not a legal opinion. No campus repository source is imported. UNKNOWN/NOASSERTION means reference-only. Copyleft projects need separate distribution review; permissive metadata still requires checking actual LICENSE, notices and transitive dependencies before copying.\n\n| Repository | SPDX metadata | Reuse decision |\n|---|---|---|\n' + [...repos.values()].map(r=>`| [${r.fullName}](${r.url}) | ${r.license} | ${r.reuse} |`).join('\n'));
console.log(`Research captured ${repos.size} distinct repositories.`);
