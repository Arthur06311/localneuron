export const languages=['pt','en','es','fr','de','ja','zh'];
const groups={pt:'BR PT AO MZ CV GW ST TL',en:'US GB AU NZ IE',es:'ES MX AR CL CO PE VE EC BO PY UY CR PA CU DO GT HN NI SV',fr:'FR MC SN CI',de:'DE AT LI',ja:'JP',zh:'CN TW HK MO'};
function acceptLanguages(accept=''){
 return accept.split(',').map((s,i)=>{const[tag,...params]=s.trim().split(';');const q=params.find(x=>x.trim().startsWith('q='));return{lang:tag.toLowerCase().split('-')[0],q:q?Number(q.trim().slice(2)):1,i}}).filter(x=>x.lang&&x.q>0&&x.q<=1).sort((a,b)=>b.q-a.q||a.i-b.i);
}
export function selectLocale(country,accept=''){
 const code=typeof country==='string'&&/^[A-Z]{2}$/.test(country)?country:null;
 const choices=acceptLanguages(accept);
 const browser=choices.find(x=>languages.includes(x.lang));
 if(browser)return{language:browser.lang,country:code,source:'browser'};
 for(const [lang,countries] of Object.entries(groups))if(countries.split(' ').includes(code))return{language:lang,country:code,source:'country'};
 return{language:'en',country:code,source:'fallback'};
}
