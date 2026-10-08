import {describe,expect,it} from 'vitest';
import {downloadStatusIssue,ProtectedDownloadFailure} from '@/features/exports/browser-download';

describe('protected export download responses',()=>{
  it('distinguishes expired exports, inaccessible exports and server failures',()=>{
    expect(downloadStatusIssue(410)).toBe('expired');
    expect(downloadStatusIssue(401)).toBe('access');
    expect(downloadStatusIssue(403)).toBe('access');
    expect(downloadStatusIssue(404)).toBe('access');
    expect(downloadStatusIssue(500)).toBe('unavailable');
  });
  it('uses controlled error reasons without exposing raw provider details',()=>{
    expect(new ProtectedDownloadFailure('expired').reason).toBe('expired');
  });
});
