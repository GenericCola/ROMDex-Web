// Keep list shortcuts separate from ordinary form and menu navigation.
export function tabAction({key,shiftKey=false,ctrlKey=false,altKey=false,metaKey=false,isComposing=false,modal=false,busy=false,inlineName=false,navigation=false,selectedCount=0}) {
  if(key!=='Tab'||ctrlKey||altKey||metaKey||isComposing||modal||busy)return null;
  if(inlineName)return shiftKey?'outdent':'indent';
  if(!navigation||shiftKey)return null;
  return selectedCount>1?'group':'cycle';
}

export function nextDetailsMode(state) {
  if(state.full)return {...state,full:false,collapsed:true};
  if(state.collapsed)return {ratio:null,full:false,collapsed:false};
  return {...state,full:true,collapsed:false};
}

export function escapeAction({key,ctrlKey=false,altKey=false,metaKey=false,isComposing=false,modal=false,busy=false,hasSelection=false,fieldFocused=false}){
  if(key!=='Escape'||ctrlKey||altKey||metaKey||isComposing||modal||busy)return null;
  return hasSelection||fieldFocused?'clear':'toggle';
}

export function nextEscapeDetailsMode(state){
  return state.collapsed?{ratio:null,full:false,collapsed:false}:{...state,full:false,collapsed:true};
}

export function renameNestingTarget(tree,id,outdent=false) {
  const item=tree.byId.get(id);
  if(!item)throw Error('The item no longer exists.');
  if(outdent){
    const parent=tree.byId.get(item.parentId);
    if(!parent)throw Error('This item is already at the top level.');
    const siblings=tree.children.get(parent.parentId)||[],at=siblings.findIndex(x=>x.id===parent.id);
    return {parentId:parent.parentId,beforeId:siblings[at+1]?.id??null,expandId:null};
  }
  const siblings=tree.children.get(item.parentId)||[],at=siblings.findIndex(x=>x.id===id),previous=siblings[at-1];
  if(!previous)throw Error('There is no preceding sibling to nest under.');
  return {parentId:previous.id,beforeId:null,expandId:previous.id};
}
