import type {ReportLanguage} from '@/features/reports/report.types';
export type ReportEmailInput={to:string;subject:string;html:string;idempotencyKey:string};
export type EmailResult={messageId:string};
export type DeliverableReport={id:string;language:ReportLanguage;subject:string;html:string;recipients:Array<{guardianId:string}>};
export type DeliverySummary={attempted:number;sent:number;skipped:number;failed:number};
