import {describe,expect,it} from 'vitest';
import {effectivePerformance,markAllPresent,todayInTimeZone,toDatabasePayload,toSparseExceptions} from '@/features/weekly-updates/weekly-update.model';
import {attendanceStatusSchema,weeklyUpdateSchema} from '@/features/weekly-updates/weekly-update.schemas';

describe('weekly update rules',()=>{
  it('uses an individual override before the group default',()=>{
    expect(effectivePerformance('GOOD',null)).toBe('GOOD');
    expect(effectivePerformance('GOOD','EXCELLENT')).toBe('EXCELLENT');
    expect(effectivePerformance(null,null)).toBeNull();
  });
  it('marks the entire roster present',()=>{
    expect(markAllPresent(['a','b'])).toEqual([{studentId:'a',status:'PRESENT'},{studentId:'b',status:'PRESENT'}]);
  });
  it('keeps only meaningful student exceptions',()=>{
    expect(toSparseExceptions([{studentId:'a',performanceOverride:null,commentEn:'',commentAr:'  '},{studentId:'b',performanceOverride:'EXCELLENT',commentEn:'Great',commentAr:''}])).toEqual([{studentId:'b',performanceOverride:'EXCELLENT',commentEn:'Great',commentAr:null}]);
  });
  it('accepts the independent teacher submission identity',()=>{
    expect(weeklyUpdateSchema.safeParse({teacherId:'c0000000-0000-4000-8000-000000000002',submissionId:null,classSubjectId:'d0000000-0000-4000-8000-000000000001',subjectGroupId:null,weekStart:'2026-09-20',progressEn:'Covered chapter 1',progressAr:'',defaultPerformance:'GOOD',attendance:[{studentId:'e0000000-0000-4000-8000-000000000001',status:'PRESENT'}],exceptions:[],intent:'draft'}).success).toBe(true);
  });
  it('allows only Present or Absent teacher observations',()=>{
    expect(attendanceStatusSchema.safeParse('PRESENT').success).toBe(true);
    expect(attendanceStatusSchema.safeParse('ABSENT').success).toBe(true);
    expect(attendanceStatusSchema.safeParse('LATE').success).toBe(false);
    expect(attendanceStatusSchema.safeParse('EXCUSED').success).toBe(false);
  });
  it('maps client field names to the database JSON contract',()=>{
    expect(toDatabasePayload([{studentId:'a',status:'PRESENT'}],[{studentId:'b',performanceOverride:'GOOD',commentEn:'Well done',commentAr:null}])).toEqual({attendance:[{student_id:'a',status:'PRESENT'}],exceptions:[{student_id:'b',performance_override:'GOOD',comment_en:'Well done',comment_ar:null}]});
  });
  it('derives the school-local week date',()=>{
    expect(todayInTimeZone('America/Edmonton',new Date('2026-09-21T05:30:00Z'))).toBe('2026-09-20');
  });
});
