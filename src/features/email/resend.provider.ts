import type {EmailProvider} from './email.provider';
type ResendEmails={send(input:{from:string;to:string;subject:string;html:string},options?:{idempotencyKey?:string}):Promise<{data:{id:string}|null;error:unknown|null}>};
export function createResendProvider(emails:ResendEmails,from:string):EmailProvider{return{name:'resend',async sendReportEmail(input){const{data,error}=await emails.send({from,to:input.to,subject:input.subject,html:input.html},{idempotencyKey:input.idempotencyKey});if(error||!data)throw new Error('Resend rejected the message');return{messageId:data.id}}};}
