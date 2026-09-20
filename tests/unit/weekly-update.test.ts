import {describe,expect,it} from 'vitest';
import {effectivePerformance,markAllPresent,todayInTimeZone,toDatabasePayload,toSparseExceptions} from '@/features/weekly-updates/weekly-update.model';
import {weeklyUpdateSchema} from '@/features/weekly-updates/weekly-update.schemas';

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
  it('accepts one authored language and validates attendance',()=>{
    expect(weeklyUpdateSchema.safeParse({sessionId:null,groupId:'11111111-1111-4111-8111-111111111111',sessionDate:'2026-09-20',progressEn:'Covered chapter 1',progressAr:'',defaultPerformance:'GOOD',attendance:[{studentId:'22222222-2222-4222-8222-222222222222',status:'PRESENT'}],exceptions:[],intent:'draft'}).success).toBe(true);
  });
  it('maps client field names to the database JSON contract',()=>{
    expect(toDatabasePayload([{studentId:'a',status:'PRESENT'}],[{studentId:'b',performanceOverride:'GOOD',commentEn:'Well done',commentAr:null}])).toEqual({attendance:[{student_id:'a',status:'PRESENT'}],exceptions:[{student_id:'b',performance_override:'GOOD',comment_en:'Well done',comment_ar:null}]});
  });
  it('derives the school-local session date',()=>{
    expect(todayInTimeZone('America/Edmonton',new Date('2026-09-21T05:30:00Z'))).toBe('2026-09-20');
  });
});
