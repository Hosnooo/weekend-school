import 'server-only';import {Resend} from 'resend';import {createResendProvider} from './resend.provider';
export function createConfiguredResendProvider(apiKey:string,from:string){return createResendProvider(new Resend(apiKey).emails,from);}
