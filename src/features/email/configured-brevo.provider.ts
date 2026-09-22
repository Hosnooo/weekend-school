import 'server-only';
import {createBrevoProvider} from './brevo.provider';

export function createConfiguredBrevoProvider(apiKey:string,from:string){
  return createBrevoProvider({apiKey,from});
}
