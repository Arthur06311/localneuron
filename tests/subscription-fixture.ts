import {generateKeyPairSync} from 'node:crypto';
import {signLease} from '../src/billing-service.js';
import type {Subscription} from '../src/subscription.js';
export const testKeys=generateKeyPairSync('ed25519');
export const testConfig={publicKey:testKeys.publicKey.export({type:'spki',format:'pem'}).toString()};
export function activateTestPro(subscription:Subscription) {
  const now=Date.now();
  subscription.install(signLease({version:1,audience:'localneuron-pro',device:subscription.snapshot().device,subscription:'sub_fixture',status:'active',issued_at:now,expires_at:now+86400_000,period_end:now+30*86400_000,cancel_at_period_end:false},testKeys.privateKey.export({type:'pkcs8',format:'pem'}).toString()));
}
