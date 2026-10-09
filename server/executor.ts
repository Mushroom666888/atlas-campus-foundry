import { spawn } from 'node:child_process';
import { AppError } from '../packages/contracts/src/index.js';

export type CommandResult={ok:boolean;exitCode:number|null;stdout:string;stderr:string;timedOut:boolean};
export function command(executable:string,args:string[],options:{cwd?:string;timeout?:number;env?:NodeJS.ProcessEnv}={}):Promise<CommandResult> {
  return new Promise(resolve=>{let stdout='',stderr='',timedOut=false;const child=spawn(executable,args,{cwd:options.cwd,env:options.env??process.env,shell:false,windowsHide:true});const timer=setTimeout(()=>{timedOut=true;child.kill();},options.timeout??60000);const limit=128000;child.stdout.on('data',chunk=>{stdout=(stdout+chunk).slice(-limit);});child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-limit);});child.on('error',error=>{clearTimeout(timer);resolve({ok:false,exitCode:null,stdout,stderr:error.message,timedOut});});child.on('close',code=>{clearTimeout(timer);resolve({ok:code===0&&!timedOut,exitCode:code,stdout,stderr,timedOut});});});
}
export async function dockerAvailable() {return (await command('docker',['info','--format','{{.ServerVersion}}'],{timeout:10000})).ok;}
export class IsolatedExecutor {
  async run(workspace:string,kind:'build'|'test'):Promise<CommandResult> {
    if(!await dockerAvailable())throw new AppError(503,'ISOLATION_UNAVAILABLE','Docker 不可用；禁止在控制服务中执行生成代码');
    const name=`foundry-check-${crypto.randomUUID()}`;
    const args=['run','--rm','--name',name,'--network','none','--cpus','1','--memory','512m','--pids-limit','128','--cap-drop','ALL','--security-opt','no-new-privileges','--read-only','--tmpfs','/tmp:rw,nosuid,nodev,size=64m','--user','1000:1000','--mount',`type=bind,source=${workspace},target=/workspace`,'--workdir','/workspace',process.env.FOUNDRY_IMAGE||'campus-foundry:local','node'];
    args.push(...(kind==='build'?['/opt/foundry/node_modules/typescript/bin/tsc','-p','tsconfig.json']:['--test','dist/feature.test.js']));
    const result=await command('docker',args,{timeout:90000});if(result.timedOut)await command('docker',['rm','-f',name],{timeout:10000});return result;
  }
}
