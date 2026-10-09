import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdir, writeFile, appendFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Projects, type Application } from './projects.js';
import { AppError, type ProductSpec } from '../packages/contracts/src/index.js';
import { dockerAvailable, command } from './executor.js';

export type Deployment={id:string;app_id:string;owner_id:string;status:string;provider:string;port:number;pid:number|null;artifact:string;spec:ProductSpec;previous_id:string|null;logs:string;created_at:string};
async function freePort() {return new Promise<number>((resolve,reject)=>{const server=createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const port=(server.address() as {port:number}).port;server.close(()=>resolve(port));});});}
export class Deployments {
  private processes=new Map<string,ChildProcess>();private locks=new Set<string>();
  constructor(private projects:Projects) {}
  async get(id:string,actor:string) {const row=(await this.projects.db.query<Deployment>('SELECT * FROM deployments WHERE id=$1 AND owner_id=$2',[id,actor])).rows[0];if(!row)throw new AppError(404,'DEPLOYMENT_NOT_FOUND','部署不存在');return row;}
  async log(id:string,text:string) {const sanitized=text.replace(/(Bearer\s+)[\w.\-]+/gi,'$1[redacted]');await this.projects.db.query('UPDATE deployments SET logs=right(logs || $2,128000),updated_at=now() WHERE id=$1',[id,sanitized]);}
  async deploy(projectId:string,actor:string,options:{spec?:ProductSpec;previousId?:string;provider?:string}={}) {
    const app=await this.projects.application(projectId,actor);if(this.locks.has(app.id))throw new AppError(409,'DEPLOYMENT_BUSY','当前应用正在部署');this.locks.add(app.id);
    try{return await this.perform(app,actor,options);}finally{this.locks.delete(app.id);}
  }
  private async perform(app:Application,actor:string,options:{spec?:ProductSpec;previousId?:string;provider?:string}) {
    const provider=options.provider??process.env.DEPLOYMENT_PROVIDER??'local-trusted';
    if(!['local-trusted','docker'].includes(provider))throw new AppError(400,'INVALID_PROVIDER','未知部署方式');
    const id=randomUUID(),port=await freePort(),spec=options.spec??app.spec;
    const previous=(await this.projects.db.query<Deployment>("SELECT * FROM deployments WHERE app_id=$1 AND status='running' ORDER BY created_at DESC LIMIT 1",[app.id])).rows[0];
    await this.projects.db.query("INSERT INTO deployments(id,app_id,owner_id,status,provider,port,spec,previous_id) VALUES($1,$2,$3,'building',$4,$5,$6,$7)",[id,app.id,actor,provider,port,JSON.stringify(spec),options.previousId??previous?.id??null]);
    try {
      const active=(await this.projects.db.query<{count:number}>("SELECT count(*)::integer AS count FROM deployments WHERE owner_id=$1 AND status IN ('running','building')",[actor])).rows[0].count;if(active>6)throw new AppError(429,'DEPLOYMENT_QUOTA','最多同时运行 6 个应用');
      const files=await this.projects.files(app.project_id,actor);const hasCode=files.some(f=>/\.(ts|js|tsx|jsx|html)$/.test(f.path));
      if(provider==='local-trusted'&&hasCode)throw new AppError(503,'ISOLATION_REQUIRED','项目包含自定义代码，必须使用 Docker 隔离部署');
      if(provider==='docker'&&!await dockerAvailable())throw new AppError(503,'DOCKER_UNAVAILABLE','Docker Engine 不可用');
      const dataDir=path.resolve(this.projects.root,'apps',app.id),artifactDir=path.resolve(this.projects.root,'artifacts',id);await mkdir(dataDir,{recursive:true});await mkdir(artifactDir,{recursive:true});
      const installs=await this.projects.installs(app.project_id,actor);const recipes=await this.projects.recipes(app.id);
      const artifact={appId:app.id,spec,modules:spec.modules,installs,recipes,source:'@campus/modules',sourceHash:createHash('sha256').update(await readFile('packages/modules/src/runtime.ts')).digest('hex'),createdAt:new Date().toISOString()};
      await writeFile(path.join(artifactDir,'artifact.json'),JSON.stringify(artifact,null,2));
      await this.projects.db.query('UPDATE deployments SET artifact=$2 WHERE id=$1',[id,artifactDir]);await this.log(id,`Artifact assembled from shared module runtime. Provider=${provider}. No LLM generation claimed.\n`);
      if(previous)await this.stop(previous.id,actor);
      const configFile=path.join(artifactDir,'runtime.json');await writeFile(configFile,JSON.stringify({...artifact,dataDir:provider==='docker'?'/app-data':dataDir}));
      await this.projects.db.query("UPDATE deployments SET status='starting' WHERE id=$1",[id]);
      if(provider==='local-trusted') {
        // Only shipped platform source executes here. Project code is rejected above.
        const env:NodeJS.ProcessEnv={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP,NODE_ENV:'production',RUNTIME_CONFIG:configFile,RUNTIME_PORT:String(port),RUNTIME_HOST:'127.0.0.1',DOTENV_CONFIG_PATH:path.join(artifactDir,'no-env-file')};
        const child=spawn(process.execPath,['--import','tsx','server/runtime-main.ts'],{cwd:process.cwd(),env,windowsHide:true,shell:false});this.processes.set(id,child);
        await this.projects.db.query('UPDATE deployments SET pid=$2 WHERE id=$1',[id,child.pid??null]);
        const logFile=path.join(artifactDir,'runtime.log');child.stdout.on('data',chunk=>{void appendFile(logFile,chunk);});child.stderr.on('data',chunk=>{void appendFile(logFile,chunk);});
        child.once('exit',()=>{this.processes.delete(id);void this.projects.db.query("UPDATE deployments SET status='stopped',updated_at=now() WHERE id=$1 AND status='running'",[id]).catch(()=>{});});
      } else {
        const network=`foundry-${app.id}`;const networkResult=await command('docker',['network','create','--internal',network]);if(!networkResult.ok&&!networkResult.stderr.includes('already exists'))throw new Error(networkResult.stderr);
        const result=await command('docker',['run','-d','--name',`foundry-${id}`,'--network',network,'--cpus','1','--memory','768m','--pids-limit','128','--cap-drop','ALL','--security-opt','no-new-privileges','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=64m','--user','1000:1000','-p',`127.0.0.1:${port}:4100`,'--mount',`type=bind,source=${dataDir},target=/app-data`,'--mount',`type=bind,source=${artifactDir},target=/artifact,readonly`,'--mount',`type=bind,source=${this.projects.workspace(app.project_id)},target=/workspace,readonly`,'-e','RUNTIME_CONFIG=/artifact/runtime.json','-e','RUNTIME_HOST=0.0.0.0','-e','RUNTIME_PORT=4100','-e','FOUNDRY_ISOLATED=docker','-e','DOTENV_CONFIG_PATH=/tmp/no-env',process.env.FOUNDRY_IMAGE||'campus-foundry:local']);
        await this.log(id,result.stdout+result.stderr);if(!result.ok)throw new Error('Container failed to start');
      }
      let healthy=false;for(let attempt=0;attempt<45;attempt++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(1000)});const body=await r.json() as {appId:string};if(r.ok&&body.appId===app.id){healthy=true;break;}}catch{}await delay(300);}
      if(!healthy)throw new Error('Health check failed');await this.projects.db.query("UPDATE deployments SET status='running',updated_at=now() WHERE id=$1",[id]);await this.log(id,'HTTP health check passed. Database is reachable.\n');await this.projects.audit(actor,'deployment.running',id,{appId:app.id,provider,port});return this.get(id,actor);
    }catch(error){await this.terminate(id,provider);await this.projects.db.query("UPDATE deployments SET status='failed',updated_at=now() WHERE id=$1",[id]);await this.log(id,`${error instanceof Error?error.message:String(error)}\n`);return this.get(id,actor);}
  }
  private async terminate(id:string,provider:string) {const process=this.processes.get(id);if(process){await new Promise<void>(resolve=>{process.once('exit',()=>resolve());process.kill();setTimeout(resolve,3000).unref();});this.processes.delete(id);}if(provider==='docker')await command('docker',['rm','-f',`foundry-${id}`],{timeout:15000});}
  async stop(id:string,actor:string){const row=await this.get(id,actor);await this.terminate(id,row.provider);await this.projects.db.query("UPDATE deployments SET status='stopped',updated_at=now() WHERE id=$1 AND status<>'failed'",[id]);await this.projects.audit(actor,'deployment.stopped',id);return {ok:true};}
  async restart(id:string,actor:string){const row=await this.get(id,actor);const app=(await this.projects.db.query<Application>('SELECT * FROM applications WHERE id=$1',[row.app_id])).rows[0];await this.stop(id,actor);return this.deploy(app.project_id,actor,{spec:row.spec,previousId:id,provider:row.provider});}
  async rollback(id:string,actor:string){const row=await this.get(id,actor);if(!row.previous_id)throw new AppError(409,'NO_PREVIOUS_DEPLOYMENT','没有上一版本');const previous=await this.get(row.previous_id,actor);const app=(await this.projects.db.query<Application>('SELECT * FROM applications WHERE id=$1',[row.app_id])).rows[0];await this.stop(id,actor);return this.deploy(app.project_id,actor,{spec:previous.spec,previousId:id,provider:previous.provider});}
  async logs(id:string,actor:string){const row=await this.get(id,actor);let logs=row.logs;if(row.artifact)try{logs+='\n'+(await readFile(path.join(row.artifact,'runtime.log'),'utf8')).slice(-100000);}catch{}if(row.provider==='docker'){const result=await command('docker',['logs','--tail','100',`foundry-${id}`],{timeout:5000});logs+='\n'+result.stdout+result.stderr;}return logs;}
  async health(id:string,actor:string){const row=await this.get(id,actor);try{const r=await fetch(`http://127.0.0.1:${row.port}/api/health`,{signal:AbortSignal.timeout(2000)});return {healthy:r.ok,body:await r.json()};}catch{return {healthy:false};}}
  async remove(id:string,actor:string){await this.stop(id,actor);await this.projects.db.query("UPDATE deployments SET status='deleted' WHERE id=$1",[id]);return {ok:true,dataRetained:true};}
  async close(){for(const id of [...this.processes.keys()])await this.terminate(id,'local-trusted');}
  async recover(){await this.projects.db.query("UPDATE deployments SET status='interrupted',logs=logs || E'\\nControl service restarted; explicit redeploy required.' WHERE status IN ('building','starting','running')");}
}
