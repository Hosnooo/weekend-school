// Local-only auth sign-in fixture using two EXISTING restored account identities.
// Never prints emails, passwords, tokens or personally identifying data.
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const apiUrl = process.env.REPORT_RECOVERY_API_URL;
const adminKey = process.env.REPORT_RECOVERY_SERVICE_KEY;
const anonKey = process.env.REPORT_RECOVERY_ANON_KEY;
const destination = process.env.REPORT_RECOVERY_CREDENTIAL_FILE;
if (apiUrl !== 'http://127.0.0.1:56421' ||
    !adminKey || !anonKey || !destination) {
  throw new Error('Refusing Auth preparation outside isolated local Supabase');
}
const db = createClient(apiUrl, adminKey, {
  auth: {persistSession: false, autoRefreshToken: false}
});
const anon = createClient(apiUrl, anonKey, {
  auth: {persistSession: false, autoRefreshToken: false}
});
async function select(table, columns) {
  const {data, error} = await db.from(table).select(columns);
  if (error) throw new Error('Private recovery preflight failed to read role links');
  return data;
}
const [profiles, administratorLinks, teacherLinks, admins, teachers] = await Promise.all([
  select('profiles', 'id,auth_user_id,school_id,is_active'),
  select('administrator_accounts', 'school_id,profile_id,administrator_id'),
  select('teacher_accounts', 'school_id,profile_id,teacher_id'),
  select('administrators', 'id,school_id,is_active'),
  select('teachers', 'id,school_id,is_active')
]);
const activeAdmins = new Set(administratorLinks.filter(link =>
  admins.some(row => row.id === link.administrator_id &&
    row.school_id === link.school_id && row.is_active)
).map(link => link.profile_id));
const activeTeachers = new Set(teacherLinks.filter(link =>
  teachers.some(row => row.id === link.teacher_id &&
    row.school_id === link.school_id && row.is_active)
).map(link => link.profile_id));
const administrator = profiles.find(p => p.is_active && activeAdmins.has(p.id));
const teacherOnly = profiles.find(p => p.is_active &&
  activeTeachers.has(p.id) && !activeAdmins.has(p.id));
if (!administrator || !teacherOnly ||
    administrator.auth_user_id === teacherOnly.auth_user_id) {
  throw new Error('Restored independent Admin and Teacher authorizations are required');
}

async function configureCredential(profile) {
  const id = profile.auth_user_id;
  const {data: record, error: getError} = await db.auth.admin.getUserById(id);
  if (getError || !record.user || !record.user.email) {
    throw new Error('Restored user could not be found by local GoTrue Auth');
  }
  const password = randomBytes(32).toString('base64url');
  const {error: updateError} = await db.auth.admin.updateUserById(id, {password});
  if (updateError) throw new Error('Local-only Auth password update failed');
  const {data: signed, error: signError} = await anon.auth.signInWithPassword({
    email: record.user.email, password
  });
  if (signError || signed.user?.id !== id) {
    throw new Error('Restored Auth identity failed an actual local password sign-in');
  }
  await anon.auth.signOut();
  return {email: record.user.email, password};
}
const admin = await configureCredential(administrator);
const teacher = await configureCredential(teacherOnly);
const cycles = await select('report_batches', 'id,school_id,scope_type,status');
const cycle = cycles.find(row => row.school_id === administrator.school_id &&
  row.scope_type === 'CLASS' && row.status === 'DRAFT');
if (!cycle) throw new Error('No saved draft report cycle available to UI smoke test');
writeFileSync(destination, JSON.stringify({admin, teacher, batchId: cycle.id}), {
  encoding: 'utf-8', mode: 0o600, flag: 'wx'
});
console.log('PASS: Restored Admin and Teacher-only users authenticated through local GoTrue.');
console.log('PASS: Both restored identities map to their original application role links.');
