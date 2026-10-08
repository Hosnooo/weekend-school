import {describe,expect,it} from 'vitest';
import {archiveErrorReason} from '@/features/archives/archive-error-guidance';

describe('archive error guidance',()=>{
  it('separates confirmation, permission, dependencies, and unknown failures',()=>{
    expect(archiveErrorReason(new Error('Permanent deletion confirmation does not match'),'delete')).toBe('confirmation');
    expect(archiveErrorReason({code:'23503',message:'private foreign key'},'delete')).toBe('dependencies');
    expect(archiveErrorReason({code:'42501',message:'private role'},'restore')).toBe('permission');
    expect(archiveErrorReason({code:'99999'},'restore')).toBe('restore');
    expect(archiveErrorReason(new Error('Only archived records can be permanently deleted'),'delete')).toBe('notArchived');
  });
});
