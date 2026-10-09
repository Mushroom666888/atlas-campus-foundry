import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { api } from './api';
import { Auth, Loading, Notice } from './components';
import { Studio } from './studio';
import { CampusApplication } from './runtime';
import type { PublicUser, ProductSpec, FeatureRecipe } from '../packages/contracts/src/index';
import './styles.css';

export type RuntimeInfo={appId:string;spec:ProductSpec;modules:string[];recipes:FeatureRecipe[];emailProvider:string};
function Root(){
  const [user,setUser]=useState<PublicUser|null>(null),[runtime,setRuntime]=useState<RuntimeInfo|null>(null),[ready,setReady]=useState(false),[error,setError]=useState('');
  useEffect(()=>{void(async()=>{try{const health=await api<{service?:string}>('/api/health');if(!health.service)setRuntime(await api<RuntimeInfo>('/api/application'));setUser((await api<{user:PublicUser|null}>('/api/auth/me')).user);setReady(true);}catch(e){setError((e as Error).message);}})();},[]);
  if(error)return <Notice>{error}</Notice>;if(!ready)return <Loading/>;
  if(!user)return <Auth onUser={setUser} title={runtime?.spec.name} runtime={Boolean(runtime)}/>;
  return runtime?<CampusApplication info={runtime} user={user} onLogout={()=>setUser(null)}/>:<BrowserRouter><Studio user={user} onLogout={()=>setUser(null)}/></BrowserRouter>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Root/></React.StrictMode>);
