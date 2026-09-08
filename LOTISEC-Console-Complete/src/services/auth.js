let accessTokenProvider=null

export function configureAccessTokenProvider(provider){
  accessTokenProvider=typeof provider==='function'?provider:null
}

export async function getAccessToken(){
  if(accessTokenProvider) return String(await accessTokenProvider()||'')
  if(typeof window==='undefined') return ''
  return String(sessionStorage.getItem('lotisec-access-token')||'')
}

export function setSessionAccessToken(token){
  if(typeof window==='undefined') return
  if(token) sessionStorage.setItem('lotisec-access-token',String(token))
  else sessionStorage.removeItem('lotisec-access-token')
}
