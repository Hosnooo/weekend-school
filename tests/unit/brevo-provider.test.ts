import {describe,expect,it,vi} from 'vitest';
import {createBrevoProvider} from '@/features/email/brevo.provider';

describe('Brevo email provider',()=>{
  it('sends a report through Brevo using the verified sender and idempotency key',async()=>{
    let url='';
    let request:RequestInit|undefined;
    const fetchImpl=vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{
      url=String(input);
      request=init;
      return new Response(JSON.stringify({messageId:'brevo-message-1'}),{status:201,headers:{'content-type':'application/json'}});
    });
    const provider=createBrevoProvider({apiKey:'brevo-test',from:'Weekend School <mohssen.elshaar@gmail.com>',fetchImpl});

    await expect(provider.sendReportEmail({to:'parent@example.com',subject:'Student report',html:'<p>Report</p>',idempotencyKey:'delivery-1'})).resolves.toEqual({messageId:'brevo-message-1'});
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(request?.method).toBe('POST');
    expect(new Headers(request?.headers).get('api-key')).toBe('brevo-test');
    expect(JSON.parse(String(request?.body))).toEqual({
      sender:{name:'Weekend School',email:'mohssen.elshaar@gmail.com'},
      to:[{email:'parent@example.com'}],
      subject:'Student report',
      htmlContent:'<p>Report</p>',
      headers:{'Idempotency-Key':'delivery-1'},
    });
  });

  it('rejects unsuccessful or malformed Brevo responses without exposing provider details',async()=>{
    const rejected=createBrevoProvider({apiKey:'brevo-test',from:'mohssen.elshaar@gmail.com',fetchImpl:async()=>new Response('{"message":"unauthorized"}',{status:401})});
    const malformed=createBrevoProvider({apiKey:'brevo-test',from:'mohssen.elshaar@gmail.com',fetchImpl:async()=>new Response('{}',{status:201,headers:{'content-type':'application/json'}})});
    const input={to:'parent@example.com',subject:'Report',html:'<p>Report</p>',idempotencyKey:'delivery-2'};

    await expect(rejected.sendReportEmail(input)).rejects.toThrow('Brevo rejected the message');
    await expect(malformed.sendReportEmail(input)).rejects.toThrow('Brevo rejected the message');
  });
});
