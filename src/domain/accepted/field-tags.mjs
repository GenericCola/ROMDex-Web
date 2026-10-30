export const PRIORITIES=[{label:'LOW',value:'Minor',color:'green'},{label:'NORMAL',value:'Normal',color:'blue'},{label:'HIGH',value:'Major',color:'yellow'},{label:'URGENT',value:'Critical',color:'red'}];
export const COMPLEXITIES=[{label:'LOW',value:'LOW',color:'green'},{label:'MID',value:'MID',color:'blue'},{label:'HIGH',value:'HIGH',color:'yellow'},{label:'INSANE',value:'INSANE',color:'red'}];
export function fieldPresentation(field,value){
 const choices=field==='priority'?PRIORITIES:COMPLEXITIES;
 if(field==='priority'&&value==='Show-stopper')return {label:'URGENT',value,color:'red',nativeOnly:true};
 return choices.find(x=>x.value===value)||(value==null?{label:'—',value:null,color:'unset'}:{label:String(value).toUpperCase()+' ⚠',value,color:'unset',unsupported:true});
}
