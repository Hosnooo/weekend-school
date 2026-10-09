import {describe,expect,it} from 'vitest';
import {administratorLifecycleError} from '@/features/administrators/administrator-lifecycle-error';

describe('Last-active Administrator guard feedback', () => {
  it('recognizes a PostgREST P0001 guard error without exposing provider details', () => {
    expect(administratorLifecycleError({
      code:'P0001',
      message:'Cannot remove the last active Administrator',
      detail:'confidential database details'
    })).toBe('last-admin');
  });
  it('preserves existing application-level last-admin feedback', () => {
    expect(administratorLifecycleError(new Error('Cannot remove the last active Administrator'))).toBe('last-admin');
  });
  it('does not misclassify other P0001 errors', () => {
    expect(administratorLifecycleError({code:'P0001',message:'unrelated server exception'})).toBe('save');
  });
  it('classifies permission errors safely', () => {
    expect(administratorLifecycleError({code:'42501',message:'sensitive policy details'})).toBe('permission');
  });
});
