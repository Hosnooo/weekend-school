import {redirect} from 'next/navigation';export default async function MyGroupsRedirect({params}:{params:Promise<{locale:string}>}){const{locale}=await params;redirect(`/${locale}/my-teaching`)}
