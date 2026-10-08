import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {formatValidationIssue} from '@/lib/validation/error-guidance';
import {persistenceFailure, validationFailure} from '@/lib/validation/action-state';

describe('actionable error guidance', () => {
  it('identifies required, email and date fields in English and Arabic', () => {
    const parsed = z.object({firstNameEn:z.string().min(1),email:z.email(),startsOn:z.iso.date()})
      .safeParse({firstNameEn:'',email:'bad-email',startsOn:'not-a-date'});
    expect(parsed.success).toBe(false);
    if(parsed.success) return;
    const state = validationFailure(parsed.error);
    expect(state.issues).toEqual(expect.arrayContaining([
      {field:'firstNameEn',reason:'required'},
      {field:'email',reason:'email'},
      {field:'startsOn',reason:'date'}
    ]));
    expect(formatValidationIssue(state.issues![1],'en')).toContain('Email address');
    expect(formatValidationIssue(state.issues![1],'ar')).toContain('البريد الإلكتروني');
    expect(JSON.stringify(state)).not.toContain('bad-email');
  });
  it('maps known database codes without forwarding private details', () => {
    expect(persistenceFailure({code:'23505',message:'private email'}).error).toBe('duplicate');
    expect(persistenceFailure({code:'23503'}).error).toBe('notFound');
    expect(persistenceFailure({code:'40001'}).error).toBe('stale');
    expect(persistenceFailure({code:'XXXXX',message:'secret'})).toEqual({status:'error',error:'save'});
  });
  it('gives date order guidance for specific custom schema rules', () => {
    const parsed=z.object({periodEnd:z.string()}).superRefine((_,ctx)=>ctx.addIssue({
      code:'custom',path:['periodEnd'],message:'Coverage end date cannot precede its start date'
    })).safeParse({periodEnd:'2026-10-01'});
    if(parsed.success) throw new Error('expected schema failure');
    expect(validationFailure(parsed.error).issues![0].reason).toBe('dateOrder');
  });
});
