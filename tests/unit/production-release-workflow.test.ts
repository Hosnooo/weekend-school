import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

const workflow = readFileSync(
  join(process.cwd(), '.github/workflows/production-supabase-migrations.yml'),
  'utf8'
);

describe('production migration release workflow', () => {
  it('releases an exact reviewed candidate through a protected manual operation', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toMatch(/^  push:/m);
    expect(workflow).toContain('ref: ${{ inputs.revision }}');
    expect(workflow).toContain('^[0-9a-f]{40}$');
    expect(workflow).toContain('test "$GITHUB_SHA" = "$RELEASE_REVISION"');
    expect(workflow).toContain('test "$(git rev-parse HEAD)" = "$RELEASE_REVISION"');
    expect(workflow).not.toContain('git rev-parse origin/main');
    expect(workflow).toContain('environment: production');
    expect(workflow).toContain('cancel-in-progress: false');
    expect(workflow).toContain('default: false');
    expect(workflow).toContain('if: ${{ inputs.apply == true }}');
  });

  it('links the intended project and previews only migrations before any apply', () => {
    expect(workflow).toContain('supabase link');
    expect(workflow).toContain('--project-ref "$SUPABASE_PROJECT_REF"');
    expect(workflow).toContain('--password "$SUPABASE_DB_PASSWORD"');
    expect(workflow).toContain('supabase migration list --linked');
    expect(workflow).toMatch(/supabase db push --linked[^\n]*--dry-run/);
    expect(workflow).toMatch(/supabase db push --linked[^\n]*--yes/);
    expect(workflow).not.toContain('--include-seed');
  });
});
