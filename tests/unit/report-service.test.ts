import {describe,expect,it} from 'vitest';
import {buildReportSnapshot,monthPeriod,selectLocalizedText} from '@/features/reports/report.service';
import {renderStudentReport} from '@/features/reports/report.renderer';

const base={school:{nameEn:'Weekend School',nameAr:'مدرسة نهاية الأسبوع'},student:{id:'student-1',nameEn:'Sara Ali',nameAr:'سارة علي'},period:{start:'2026-09-01',end:'2026-09-30'},generatedAt:'2026-09-30T18:00:00Z'};
const sessions=[
 {id:'s1',status:'SUBMITTED' as const,date:'2026-09-07',group:{id:'g1',nameEn:'Level 1',nameAr:'المستوى ١'},attendance:'PRESENT' as const,progressEn:'Letters',progressAr:null,defaultPerformance:'GOOD' as const,performanceOverride:null,commentEn:null,commentAr:null},
 {id:'s2',status:'DRAFT' as const,date:'2026-09-14',group:{id:'g1',nameEn:'Level 1',nameAr:'المستوى ١'},attendance:'ABSENT' as const,progressEn:'Ignored draft',progressAr:null,defaultPerformance:'NEEDS_SUPPORT' as const,performanceOverride:null,commentEn:null,commentAr:null},
 {id:'s3',status:'SUBMITTED' as const,date:'2026-09-21',group:{id:'g2',nameEn:'Reading A',nameAr:'القراءة أ'},attendance:'LATE' as const,progressEn:null,progressAr:'القراءة',defaultPerformance:'GOOD' as const,performanceOverride:'EXCELLENT' as const,commentEn:'Strong work <today>',commentAr:null}
];

describe('report aggregation',()=>{
 it('excludes drafts, counts attendance, preserves moved groups, and uses latest override',()=>{const result=buildReportSnapshot({...base,language:'both' as const,sessions});expect(result.issues).toEqual([]);expect(result.snapshot?.attendance).toEqual({present:1,absent:0,late:1,excused:0,sessions:2});expect(result.snapshot?.groups.map(({nameEn})=>nameEn)).toEqual(['Level 1','Reading A']);expect(result.snapshot?.currentPerformance).toBe('EXCELLENT');});
 it('reports missing data without inventing performance',()=>{const result=buildReportSnapshot({...base,language:'en' as const,sessions:[{...sessions[0],attendance:null,defaultPerformance:null}]});expect(result.snapshot).toBeNull();expect(result.issues).toEqual(['INCOMPLETE_ATTENDANCE','MISSING_PERFORMANCE']);});
 it('falls back without duplicating a single available translation',()=>{expect(selectLocalizedText('English',null,'ar')).toEqual(['English']);expect(selectLocalizedText('English',null,'both')).toEqual(['English']);expect(selectLocalizedText('English','العربية','both')).toEqual(['English','العربية']);});
 it('renders escaped, localized HTML from the immutable snapshot',()=>{const result=buildReportSnapshot({...base,language:'en' as const,sessions});const html=renderStudentReport(result.snapshot!,'en');expect(html).toContain('Sara Ali');expect(html).toContain('Strong work &lt;today&gt;');expect(html).not.toContain('Ignored draft');expect(html).not.toContain('<today>');});
 it('renders bilingual labels and both authored languages',()=>{const result=buildReportSnapshot({...base,language:'both' as const,sessions});const html=renderStudentReport(result.snapshot!,'both');expect(html).toContain('Student Report / تقرير الطالب');expect(html).toContain('Letters');expect(html).toContain('القراءة');});
 it('builds the inclusive calendar-month period',()=>{expect(monthPeriod('2028-02-17')).toEqual({periodStart:'2028-02-01',periodEnd:'2028-02-29'});});
});
