import type {EmailResult,ReportEmailInput} from './email.types';
export interface EmailProvider{name:string;sendReportEmail(input:ReportEmailInput):Promise<EmailResult>}
