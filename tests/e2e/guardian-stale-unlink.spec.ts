import {randomUUID} from 'node:crypto';

import {createClient} from '@supabase/supabase-js';
import {expect, test} from '@playwright/test';

import {credentials, login} from './helpers';

const schoolId = 'a0000000-0000-0000-0000-000000000001';
const studentId = 'e0000000-0000-0000-0000-000000000001';

/**
 * Destructive test setup is permitted ONLY against the local Supabase test
 * environment. This independently repeats the guard in playwright.config.
 */
function localServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(url) || !key) {
    throw new Error('Refusing to run failure-injection tests against a hosted Supabase project');
  }
  return createClient(url, key, {auth: {persistSession:false, autoRefreshToken:false}});
}

test.describe('isolated stale Student–Guardian relationship', () => {
  test('shows a corrective error when another administrator removes the link before confirmation', async ({page}) => {
    const supabase = localServiceClient();
    const guardianId = randomUUID();
    const guardianName = `Failure Test ${guardianId.slice(0,8)}`;

    const {error: guardianError} = await supabase.from('guardians').insert({
      school_id:schoolId,
      id:guardianId,
      name:guardianName,
      email:`failure-${guardianId}@example.test`,
      phone:'+1 780 555 0100',
      report_language:'en',
      is_active:true
    });
    if (guardianError) throw guardianError;

    try {
      const {error: linkError} = await supabase.from('student_guardians').insert({
        school_id:schoolId,
        student_id:studentId,
        guardian_id:guardianId,
        is_primary:false,
        receives_reports:false
      });
      if (linkError) throw linkError;

      await login(page,'en',credentials.admin);
      await page.goto(`/en/students/${studentId}`);

      const card = page.locator('.record-card').filter({hasText:guardianName});
      await expect(card).toBeVisible();

      // A second administrator modifies the test database after first page load.
      const {error: concurrentDeleteError} = await supabase.from('student_guardians')
        .delete()
        .eq('school_id',schoolId)
        .eq('student_id',studentId)
        .eq('guardian_id',guardianId);
      if (concurrentDeleteError) throw concurrentDeleteError;

      // Prove the relationship really was removed in the local database.
      // Supabase delete() can return no error even when zero rows matched.
      const {count: remainingLinks, error: linkLookupError} = await supabase
        .from('student_guardians')
        .select('guardian_id', {count: 'exact', head: true})
        .eq('school_id', schoolId)
        .eq('student_id', studentId)
        .eq('guardian_id', guardianId);
      if (linkLookupError) throw linkLookupError;
      expect(remainingLinks).toBe(0);

      page.once('dialog',dialog => dialog.accept());
      await card.getByRole('button',{name:'Remove from student'}).click();

      // The app must explain stale state, never treat the missing link as success.
      await expect(card.getByRole('alert')).toContainText('changed while you were editing');
      await page.reload();

      // After unlinking, the Guardian still exists and can legitimately
      // appear in the "Link existing Guardian" directory below the cards.
      // Only the linked Guardian card must disappear for this student.
      await expect(page.locator('.record-card').filter({hasText: guardianName})).toHaveCount(0);
    } finally {
      await supabase.from('student_guardians').delete()
        .eq('school_id',schoolId)
        .eq('student_id',studentId)
        .eq('guardian_id',guardianId);
      const {error: cleanupError} = await supabase.from('guardians')
        .delete()
        .eq('school_id',schoolId)
        .eq('id',guardianId);
      if (cleanupError) throw cleanupError;
    }
  });
});
