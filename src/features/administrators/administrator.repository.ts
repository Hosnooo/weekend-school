import 'server-only';

import {createServerSupabaseClient} from '@/lib/supabase/server';
import {createServiceRoleSupabaseClient} from '@/lib/supabase/service-role';

export type AdministratorListItem = {
  id: string;
  email: string | null;
  accountProfileId: string | null;
  authUserId: string | null;
  displayName: string;
  isActive: boolean;
};

type AdministratorRow = {
  id: string;
  display_name: string;
  email: string | null;
  is_active: boolean;
};

type AdministratorAccountRow = {
  administrator_id: string;
  profile_id: string;
  profiles: {id: string; auth_user_id: string; is_active: boolean} | null;
};

export async function listAdministrators(schoolId: string): Promise<AdministratorListItem[]> {
  const db = await createServerSupabaseClient();
  const [{data: administrators, error: administratorError}, {data: accounts, error: accountError}] = await Promise.all([
    db.from('administrators')
      .select('id,display_name,email,is_active')
      .eq('school_id', schoolId)
      .order('display_name'),
    db.from('administrator_accounts')
      .select('administrator_id,profile_id,profiles(id,auth_user_id,is_active)')
      .eq('school_id', schoolId)
  ]);
  if (administratorError) throw administratorError;
  if (accountError) throw accountError;

  const accountByAdministrator = new Map<string, AdministratorAccountRow>();
  for (const account of accounts as unknown as AdministratorAccountRow[]) {
    if (!accountByAdministrator.has(account.administrator_id) && account.profiles) {
      accountByAdministrator.set(account.administrator_id, account);
    }
  }

  return (administrators as AdministratorRow[]).map((administrator) => {
    const account = accountByAdministrator.get(administrator.id) ?? null;
    return {
      id: administrator.id,
      email: administrator.email,
      accountProfileId: account?.profile_id ?? null,
      authUserId: account?.profiles?.auth_user_id ?? null,
      displayName: administrator.display_name,
      isActive: administrator.is_active
    };
  });
}

export async function getAdministratorAccessStates(
  administrators: AdministratorListItem[]
): Promise<Record<string, 'signedIn' | 'linkSent' | 'unknown'>> {
  const db = createServiceRoleSupabaseClient();
  const entries = await Promise.all(administrators.map(async (administrator) => {
    if (!administrator.authUserId) return [administrator.id, 'unknown'] as const;
    const {data, error} = await db.auth.admin.getUserById(administrator.authUserId);
    if (error || !data.user) return [administrator.id, 'unknown'] as const;
    return [
      administrator.id,
      data.user.last_sign_in_at ? 'signedIn' : data.user.invited_at ? 'linkSent' : 'unknown'
    ] as const;
  }));
  return Object.fromEntries(entries);
}

export async function insertAdministrator(input: {
  schoolId: string;
  displayName: string;
  email: string;
}) {
  const db = await createServerSupabaseClient();
  const {data, error} = await db.from('administrators').insert({
    school_id: input.schoolId,
    display_name: input.displayName,
    email: input.email
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function loadAdministratorWithServiceRole(administratorId: string, schoolId: string) {
  const db = createServiceRoleSupabaseClient();
  const {data, error} = await db.from('administrators')
    .select('id,school_id,display_name,email,is_active')
    .eq('id', administratorId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (error) throw error;
  return data ? {
    id: data.id as string,
    schoolId: data.school_id as string,
    displayName: data.display_name as string,
    email: data.email as string | null,
    isActive: data.is_active as boolean
  } : null;
}

export async function countActiveAdministratorsWithServiceRole(schoolId: string) {
  const db = createServiceRoleSupabaseClient();
  const {count, error} = await db.from('administrators')
    .select('id', {count: 'exact', head: true})
    .eq('school_id', schoolId)
    .eq('is_active', true);
  if (error) throw error;
  return count ?? 0;
}

export async function setAdministratorActiveWithServiceRole(
  schoolId: string,
  administratorId: string,
  isActive: boolean
) {
  const db = createServiceRoleSupabaseClient();
  const {error} = await db.from('administrators')
    .update({is_active: isActive})
    .eq('school_id', schoolId)
    .eq('id', administratorId);
  if (error) throw error;
}

export async function deleteAdministratorWithAccountLinksWithServiceRole(
  schoolId: string,
  administratorId: string
) {
  const db = createServiceRoleSupabaseClient();
  const {error} = await db.rpc('delete_administrator_with_accounts', {
    p_school_id: schoolId,
    p_administrator_id: administratorId
  });
  if (error) throw error;
}
