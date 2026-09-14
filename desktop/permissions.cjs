function allowsClipboard(permission, requestingUrl, mainUrl, origin) {
  if(permission!=='clipboard-sanitized-write')return false;
  try{return new URL(requestingUrl).origin===origin&&new URL(mainUrl).origin===origin;}catch{return false;}
}
module.exports={allowsClipboard};
function allowsMicrophone(permission, requestingUrl, mainUrl, details={}) {
 if(permission!=='media')return false;
 try{if(new URL(requestingUrl).origin!=='http://127.0.0.1:4318'||new URL(mainUrl).origin!=='http://127.0.0.1:4318')return false;}catch{return false;}
 if(details.mediaType==='video'||details.mediaTypes?.includes('video'))return false;
 return details.mediaType==='audio'||Array.isArray(details.mediaTypes)&&details.mediaTypes.length===1&&details.mediaTypes[0]==='audio';
}
module.exports.allowsMicrophone=allowsMicrophone;
