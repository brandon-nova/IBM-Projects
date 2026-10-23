export function projectViewUrl(params: Record<string,string|string[]|undefined>,mine: boolean,clear=false) {
  const query=new URLSearchParams();
  if(mine) query.set("my","1");
  if(!clear) for(const key of ["q","skill","status","learn"]) {
    const value=params[key];
    if(typeof value==="string" && value.trim()) query.set(key,value.trim().slice(0,100));
  }
  return `/projects${query.size ? `?${query}` : ""}`;
}
