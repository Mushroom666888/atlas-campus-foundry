import 'dotenv/config';
import { createControl } from './control.js';
const {app}=await createControl({frontend:true,logger:true,recover:true});
await app.listen({host:process.env.HOST||'127.0.0.1',port:Number(process.env.PORT||3000)});
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{void app.close().then(()=>process.exit(0));});
