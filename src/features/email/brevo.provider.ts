import type {EmailProvider} from './email.provider';

const BREVO_SEND_URL='https://api.brevo.com/v3/smtp/email';

type FetchImplementation=(input:string|URL|Request,init?:RequestInit)=>Promise<Response>;

type BrevoProviderOptions={
  apiKey:string;
  from:string;
  fetchImpl?:FetchImplementation;
};

function parseSender(from:string){
  const namedSender=/^\s*(.*?)\s*<([^<>]+)>\s*$/.exec(from);
  if(!namedSender)return{email:from.trim()};
  return{name:namedSender[1].trim().replace(/^"|"$/g,''),email:namedSender[2].trim()};
}

export function createBrevoProvider({apiKey,from,fetchImpl=fetch}:BrevoProviderOptions):EmailProvider{
  return{
    name:'brevo',
    async sendReportEmail(input){
      const response=await fetchImpl(BREVO_SEND_URL,{
        method:'POST',
        headers:{accept:'application/json','api-key':apiKey,'content-type':'application/json'},
        body:JSON.stringify({
          sender:parseSender(from),
          to:[{email:input.to}],
          subject:input.subject,
          htmlContent:input.html,
          headers:{'Idempotency-Key':input.idempotencyKey},
        }),
      });
      if(!response.ok)throw new Error('Brevo rejected the message');
      try{
        const result=await response.json() as {messageId?:unknown};
        if(typeof result.messageId!=='string'||result.messageId.length===0)throw new Error('Invalid Brevo response');
        return{messageId:result.messageId};
      }catch{
        throw new Error('Brevo rejected the message');
      }
    },
  };
}
