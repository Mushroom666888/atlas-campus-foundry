import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { AppError } from '../packages/contracts/src/index.js';

export interface EmailProvider { send(to: string, subject: string, text: string): Promise<{ provider: string }> }
export class LocalOutbox implements EmailProvider {
  constructor(private root: string) {}
  async send(to:string,subject:string,text:string) { await mkdir(this.root,{recursive:true}); await writeFile(path.join(this.root,`${randomUUID()}.json`),JSON.stringify({to,subject,text,createdAt:new Date().toISOString()}),{mode:0o600}); return {provider:'local-outbox'}; }
}
export class SmtpEmail implements EmailProvider {
  async send(to:string,subject:string,text:string) {
    if (!process.env.SMTP_URL || !process.env.EMAIL_FROM) throw new AppError(503,'EMAIL_UNCONFIGURED','SMTP_URL and EMAIL_FROM required');
    await nodemailer.createTransport(process.env.SMTP_URL).sendMail({from:process.env.EMAIL_FROM,to,subject,text}); return {provider:'smtp'};
  }
}
export const emailProvider = (dataDir:string): EmailProvider => process.env.EMAIL_PROVIDER === 'smtp' ? new SmtpEmail() : new LocalOutbox(path.join(dataDir,'outbox'));
export interface MapProvider { url(latitude:number,longitude:number): string }
export class OpenStreetMap implements MapProvider {
  url(latitude:number,longitude:number) { if (!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180) throw new AppError(400,'INVALID_LOCATION','Invalid coordinates'); return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`; }
}
