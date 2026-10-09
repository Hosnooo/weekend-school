import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('Optional Teacher and Administrator performance', () => {
  it('leaves Teacher performance optional without a required default', () => {
    const schema = readFileSync(
      'src/features/teaching-updates/teaching-update.schemas.ts', 'utf8'
    );
    const editor = readFileSync(
      'src/features/teaching-updates/teaching-update-editor.tsx', 'utf8'
    );
    expect(schema).toContain('defaultPerformance: performanceSchema.nullable()');
    expect(schema).toContain('performanceOverride: performanceSchema.nullable()');
    expect(editor).toContain("update.defaultPerformance ?? ''");
    expect(editor).toContain("weekly('performanceOptionalHelp')");
  });

  it('supports inherit, explicit rating and deliberately omitted rating', () => {
    const editor = readFileSync(
      'src/features/reports/report-cycle-source-review.tsx', 'utf8'
    );
    const actions = readFileSync(
      'src/features/reports/class-report-review.actions.ts', 'utf8'
    );
    expect(editor).toContain('student.performanceOverridden');
    expect(editor).toContain("student.performance ?? '__OMIT__'");
    expect(editor).toContain('<option value="__OMIT__">');
    expect(editor).toContain("t('omitPerformance')");
    expect(actions).toContain("rawPerformance !== '__OMIT__'");
    expect(actions).toContain('includePerformance && Boolean(rawPerformance)');
  });

  it('persists explicit omission as null with override flag and uses it in reports', () => {
    const repository = readFileSync(
      'src/features/reports/class-report-review.repository.ts', 'utf8'
    );
    const finalizer = readFileSync(
      'src/features/reports/class-report-finalization.repository.ts', 'utf8'
    );
    expect(repository).toContain('fields.performance = student.performanceOverridden');
    expect(repository).toContain('fields.performance_overridden = student.performanceOverridden');
    expect(finalizer).toContain('explicitOverride?.performance_overridden');
    expect(finalizer).toContain('? explicitOverride.performance');
  });

  it('never clears saved Admin fields only because a template control is disabled', () => {
    const repository = readFileSync(
      'src/features/reports/class-report-review.repository.ts', 'utf8'
    );
    expect(repository).toContain('if (input.includePerformance)');
    expect(repository).toContain('if (input.includeStudentComments)');
    expect(repository).toContain('.update(fields)');
    expect(repository).toContain('.select(\'id\')');
  });
});
