'use client';

import {useRouter} from 'next/navigation';
import {useEffect,useMemo,useState} from 'react';
import {useTranslations} from 'next-intl';
import {z} from 'zod';

import {Button} from '@/components/ui/button';
import {createBrowserSupabaseClient} from '@/lib/supabase/browser';

const passwordSchema=z.string().min(8).regex(/[A-Za-z]/).regex(/[0-9]/);

export function SetPasswordForm({locale}:{locale:'en'|'ar'}){
  const t=useTranslations('auth');
  const router=useRouter();
  const supabase=useMemo(()=>createBrowserSupabaseClient(),[]);
  const[ready,setReady]=useState(false);
  const[pending,setPending]=useState(false);
  const[error,setError]=useState<'invalid'|'password'|null>(null);

  useEffect(()=>{let active=true;let invalidTimer:ReturnType<typeof setTimeout>|undefined;const accept=(hasSession:boolean)=>{if(!active)return;if(hasSession){if(invalidTimer)clearTimeout(invalidTimer);setError(null);setReady(true)}else{invalidTimer=setTimeout(()=>{if(active)setError('invalid')},1500)}};const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>accept(Boolean(session)));const code=new URLSearchParams(window.location.search).get('code');const hash=new URLSearchParams(window.location.hash.slice(1));const accessToken=hash.get('access_token');const refreshToken=hash.get('refresh_token');const establish=code?supabase.auth.exchangeCodeForSession(code):accessToken&&refreshToken?supabase.auth.setSession({access_token:accessToken,refresh_token:refreshToken}):supabase.auth.getSession();establish.then(({data})=>accept(Boolean(data.session))).catch(()=>accept(false));return()=>{active=false;if(invalidTimer)clearTimeout(invalidTimer);subscription.unsubscribe()}},[supabase]);

  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);const parsed=passwordSchema.safeParse(form.get('password'));if(!parsed.success){setError('password');return}setPending(true);setError(null);const{error:updateError}=await supabase.auth.updateUser({password:parsed.data});if(updateError){setError('password');setPending(false);return}const{data:{user},error:userError}=await supabase.auth.getUser();if(userError||!user){setError('invalid');setPending(false);return}const{data:profile,error:profileError}=await supabase.from('profiles').select('role,is_active').eq('auth_user_id',user.id).maybeSingle();if(profileError||!profile?.is_active){setError('invalid');setPending(false);return}router.replace(profile.role==='ADMIN'?`/${locale}/dashboard`:`/${locale}/my-groups`);router.refresh()}

  if(error==='invalid')return <p className="form-error" role="alert">{t('invalidInvitation')}</p>;
  return <form onSubmit={submit}><label>{t('newPassword')}<input autoComplete="new-password" disabled={!ready||pending} minLength={8} name="password" required type="password"/></label><p>{t('passwordRequirements')}</p>{error==='password'?<p className="form-error" role="alert">{t('passwordUpdateError')}</p>:null}<Button disabled={!ready||pending} type="submit">{pending?t('settingPassword'):t('setPassword')}</Button></form>;
}
