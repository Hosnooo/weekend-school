import {describe,expect,it} from 'vitest';
import {lifecycleErrorKey} from '@/lib/validation/lifecycle-feedback';
import {archiveErrorReason} from '@/features/archives/archive-error-guidance';

describe('safe lifecycle operation feedback',()=>{
  it('classifies common exceptions without exposing technical messages',()=>{
    expect(archiveErrorReason({code:'42501',message:'raw privilege message'},'archive')).toBe('permission');
    expect(archiveErrorReason({code:'23503',message:'raw foreign key'},'archive')).toBe('dependencies');
    expect(archiveErrorReason({code:'P0002'},'archive')).toBe('stale');
    expect(archiveErrorReason({code:'XXXXX'},'archive')).toBe('archive');
  });
  it('maps failure codes to safe translation keys',()=>{
    expect(lifecycleErrorKey('permission')).toBe('permission');
    expect(lifecycleErrorKey('dependencies')).toBe('rule');
    expect(lifecycleErrorKey('notFound')).toBe('notFound');
    expect(lifecycleErrorKey('unexpected-private-string')).toBe('lifecycleError');
  });
});
