import {describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
vi.mock('@/lib/supabase/server',()=>({createServerSupabaseClient:vi.fn()}));

import {computeRecipientReadiness} from '@/features/reports/recipient-delivery.repository';
import {sendReportDeliveries} from '@/features/email/email.service';

const r = (id:string,student_id:string,language:'en'|'ar'|'both'='both') => ({
  id,student_id,batch_id:'batch',period_start:'2026-10-01',period_end:'2026-10-11',
  status:'READY' as const,language,
  students:{first_name_en:'Student',last_name_en:id,first_name_ar:null,last_name_ar:null}
});
const g=(student_id:string,guardian_id:string,report_language:'en'|'ar'|'both')=>({
  student_id,guardian_id,guardians:{email:guardian_id+'@example.org',is_active:true,report_language}
});
describe('Guardian email recipient readiness',()=>{
  it('accepts English and Arabic guardians for bilingual reports',()=>{
    const state=computeRecipientReadiness([r('r1','s1'),r('r2','s2')],
      [g('s1','g1','en'),g('s1','g2','ar')],
      [{student_id:'s1',guardian_id:'g1',period_start:'2026-10-01',period_end:'2026-10-11',status:'SENT'}]);
    expect(state.reportCount).toBe(2);
    expect(state.eligibleReports).toBe(1);
    expect(state.readyEmails).toBe(1);
    expect(state.alreadySent).toBe(1);
    expect(state.missing).toHaveLength(1);
  });
  it('does not use guardians who are inactive or prefer an incompatible monolingual report',()=>{
    const link=g('s1','g1','ar');
    expect(computeRecipientReadiness([r('r1','s1','en')],[link],[]).missing).toHaveLength(1);
    link.guardians.is_active=false;
    expect(computeRecipientReadiness([r('r1','s1')],[link],[]).readyEmails).toBe(0);
  });
  it('shows failed messages as retryable and pending ones as reconciliation',()=>{
    const state=computeRecipientReadiness([r('r1','s1')],
      [g('s1','g1','en'),g('s1','g2','ar')],
      [
        {student_id:'s1',guardian_id:'g1',period_start:'2026-10-01',period_end:'2026-10-11',status:'FAILED'},
        {student_id:'s1',guardian_id:'g2',period_start:'2026-10-01',period_end:'2026-10-11',status:'PENDING'}
      ]);
    expect(state.readyEmails).toBe(1);
    expect(state.pendingReview).toBe(1);
    expect(state.attention[0].reason).toBe('FAILED');
  });
});
describe('Never replay a confirmed or uncertain email',()=>{
  const report={id:'r',language:'both' as const,subject:'Report',html:'<p>Report</p>',
    recipients:[{guardianId:'g'}]};
  for(const [name,reconciliation] of [['already sent',false],['pending',true]] as const){
    it('skips '+name+' deliveries',async()=>{
      const send=vi.fn();
      const result=await sendReportDeliveries(report,{name:'brevo',sendReportEmail:send},{
        reserveDelivery:async()=>({deliveryId:'d',recipientEmail:'guardian@example.org',
          shouldSend:false,requiresReconciliation:reconciliation}),
        completeDelivery:vi.fn()
      });
      expect(result.sent).toBe(0);
      expect(reconciliation?result.pendingReview:result.alreadySent).toBe(1);
      expect(send).not.toHaveBeenCalled();
    });
  }
});
