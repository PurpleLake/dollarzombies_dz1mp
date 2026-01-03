export const DZMAP_VERSION = 1;

export function buildTagMask(tags, registry){
  let mask = 0;
  for(const t of tags||[]){
    const idx = registry.indexOf(t);
    if(idx >=0 && idx < 32){ mask |= (1 << idx); }
  }
  return mask >>> 0;
}
