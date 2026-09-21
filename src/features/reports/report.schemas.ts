import {z} from 'zod';
export const reportPeriodSchema=z.object({periodStart:z.iso.date(),periodEnd:z.iso.date()}).refine(({periodStart,periodEnd})=>periodEnd>=periodStart,{message:'Period end must be on or after its start'});
export type ReportPeriod=z.infer<typeof reportPeriodSchema>;
