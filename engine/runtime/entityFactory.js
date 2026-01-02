export function instantiateObjects(data){
  const instances = [];
  (data.objects||[]).forEach((obj)=>{
    instances.push({ prefabIndex: obj[0], position: obj.slice(1,4) });
  });
  return instances;
}
