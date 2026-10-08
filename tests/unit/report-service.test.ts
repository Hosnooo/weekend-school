import {describe,expect,it} from 'vitest';
import {
  buildReportSnapshot,
  buildReportSnapshotV2,
  monthPeriod,
  selectLocalizedText
} from '@/features/reports/report.service';
import {renderStudentReport,renderStudentReportV2} from '@/features/reports/report.renderer';

const base={school:{nameEn:'Weekend School',nameAr:'مدرسة نهاية الأسبوع'},student:{id:'student-1',nameEn:'Sara Ali',nameAr:'سارة علي'},period:{start:'2026-09-01',end:'2026-09-30'},generatedAt:'2026-09-30T18:00:00Z'};
const sessions=[
 {id:'s1',status:'SUBMITTED' as const,date:'2026-09-07',group:{id:'g1',nameEn:'Level 1',nameAr:'المستوى ١'},attendance:'PRESENT' as const,progressEn:'Letters',progressAr:null,defaultPerformance:'GOOD' as const,performanceOverride:null,commentEn:null,commentAr:null},
 {id:'s2',status:'DRAFT' as const,date:'2026-09-14',group:{id:'g1',nameEn:'Level 1',nameAr:'المستوى ١'},attendance:'ABSENT' as const,progressEn:'Ignored draft',progressAr:null,defaultPerformance:'NEEDS_SUPPORT' as const,performanceOverride:null,commentEn:null,commentAr:null},
 {id:'s3',status:'SUBMITTED' as const,date:'2026-09-21',group:{id:'g2',nameEn:'Reading A',nameAr:'القراءة أ'},attendance:'LATE' as const,progressEn:null,progressAr:'القراءة',defaultPerformance:'GOOD' as const,performanceOverride:'EXCELLENT' as const,commentEn:'Strong work <today>',commentAr:null}
];

describe('report aggregation',()=>{
 it('excludes drafts, counts attendance, preserves moved groups, and uses latest override',()=>{const result=buildReportSnapshot({...base,language:'both' as const,sessions});expect(result.issues).toEqual([]);expect(result.snapshot?.attendance).toEqual({present:1,absent:0,late:1,excused:0,sessions:2});expect(result.snapshot?.groups.map(({nameEn})=>nameEn)).toEqual(['Level 1','Reading A']);expect(result.snapshot?.currentPerformance).toBe('EXCELLENT');});
 it('reports incomplete attendance but represents an unrated performance honestly',()=>{const result=buildReportSnapshot({...base,language:'en' as const,sessions:[{...sessions[0],attendance:null,defaultPerformance:null}]});expect(result.snapshot).toBeNull();expect(result.issues).toEqual(['INCOMPLETE_ATTENDANCE']);});
 it('renders a submitted student with no performance as not rated',()=>{const result=buildReportSnapshot({...base,language:'en' as const,sessions:[{...sessions[0],defaultPerformance:null}]});expect(result.issues).toEqual([]);expect(result.snapshot?.currentPerformance).toBeNull();expect(renderStudentReport(result.snapshot!,'en')).toContain('Not rated');});
 it('falls back without duplicating a single available translation',()=>{expect(selectLocalizedText('English',null,'ar')).toEqual(['English']);expect(selectLocalizedText('English',null,'both')).toEqual(['English']);expect(selectLocalizedText('English','العربية','both')).toEqual(['English','العربية']);});
 it('renders escaped, localized HTML from the immutable snapshot',()=>{const result=buildReportSnapshot({...base,language:'en' as const,sessions});const html=renderStudentReport(result.snapshot!,'en');expect(html).toContain('Sara Ali');expect(html).toContain('Strong work &lt;today&gt;');expect(html).not.toContain('Ignored draft');expect(html).not.toContain('<today>');});
 it('renders bilingual labels and both authored languages',()=>{const result=buildReportSnapshot({...base,language:'both' as const,sessions});const html=renderStudentReport(result.snapshot!,'both');expect(html).toContain('Student Report / تقرير الطالب');expect(html).toContain('Letters');expect(html).toContain('القراءة');});
 it('builds the inclusive calendar-month period',()=>{expect(monthPeriod('2028-02-17')).toEqual({periodStart:'2028-02-01',periodEnd:'2028-02-29'});});
});

const quranSection={
 classSubjectId:'cs-quran',subjectNameEn:'Quran',subjectNameAr:'القرآن',groupNameEn:'Quran A',groupNameAr:'القرآن أ',
 approvedProgressEn:'Surah Al-Fatiha',approvedProgressAr:'سورة الفاتحة',performance:'GOOD' as const,
 attendance:{present:3,absent:1,sessions:4},commentEn:'Steady recitation',commentAr:null,
 sourceTeacherNames:['Internal Teacher One'],unresolvedAttendanceConflicts:0
};
const arabicSection={
 classSubjectId:'cs-arabic',subjectNameEn:'Arabic',subjectNameAr:'العربية',groupNameEn:null,groupNameAr:null,
 approvedProgressEn:'Reading short sentences',approvedProgressAr:'قراءة جمل قصيرة',performance:'EXCELLENT' as const,
 attendance:{present:4,absent:0,sessions:4},commentEn:null,commentAr:'تقدم ممتاز',
 sourceTeacherNames:['Internal Teacher Two'],unresolvedAttendanceConflicts:0
};
const v2Base={
 school:{nameEn:'MCE Weekend School',nameAr:'مدرسة MCE لنهاية الأسبوع'},
 student:{id:'student-1',nameEn:'Sara Ali',nameAr:'سارة علي'},
 class:{id:'class-1',nameEn:'Level 1',nameAr:'المستوى ١'},
 period:{start:'2026-09-01',end:'2026-09-30'},language:'both' as const,
 template:{introEn:'Monthly learning summary',introAr:null,closingEn:null,closingAr:'مع تمنياتنا بالتوفيق'},
 generatedAt:'2026-09-30T18:00:00Z'
};

describe('subject-aware report snapshot v2',()=>{
 it('keeps approved Subject sections separate and excludes internal teacher identity from parent output',()=>{
  const result=buildReportSnapshotV2({...v2Base,sections:[quranSection,arabicSection]});
  expect(result.issues).toEqual([]);
  expect(result.snapshot?.version).toBe(2);
  expect(result.snapshot?.author).toBe('MCE Weekend School');
  expect(result.snapshot?.sections.map((section)=>({subject:section.subjectNameEn,progress:section.approvedProgressEn,performance:section.performance}))).toEqual([
   {subject:'Quran',progress:'Surah Al-Fatiha',performance:'GOOD'},
   {subject:'Arabic',progress:'Reading short sentences',performance:'EXCELLENT'}
  ]);
  const serialized=JSON.stringify(result.snapshot);
  expect(serialized).not.toContain('Internal Teacher One');
  expect(serialized).not.toContain('Internal Teacher Two');
  const html=renderStudentReportV2(result.snapshot!,'both');
  expect(html).toContain('Surah Al-Fatiha');
  expect(html).toContain('Reading short sentences');
  expect(html).toContain('MCE Weekend School');
  expect(html).not.toContain('Internal Teacher One');
  expect(html).not.toContain('Internal Teacher Two');
 });

 it('allows report generation while disputed attendance is unverified',()=>{
  const result=buildReportSnapshotV2({...v2Base,sections:[quranSection,{...arabicSection,unresolvedAttendanceConflicts:1}]});
  expect(result.snapshot?.version).toBe(2);
  expect(result.issues).toEqual([{code:'UNRESOLVED_ATTENDANCE_CONFLICT',classSubjectId:'cs-arabic'}]);
  expect(renderStudentReportV2(result.snapshot!, 'both')).toContain('Attendance: Not recorded');
 });
});
