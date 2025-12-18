function clone(obj){
  return JSON.parse(JSON.stringify(obj));
}

export class UndoStack {
  constructor(limit=100){
    this.limit = limit;
    this.undo = [];
    this.redo = [];
  }

  push(state){
    this.undo.push(clone(state));
    if(this.undo.length > this.limit) this.undo.shift();
    this.redo.length = 0;
  }

  canUndo(){
    return this.undo.length > 0;
  }

  canRedo(){
    return this.redo.length > 0;
  }

  undoState(current){
    if(!this.canUndo()) return null;
    this.redo.push(clone(current));
    return this.undo.pop();
  }

  redoState(current){
    if(!this.canRedo()) return null;
    this.undo.push(clone(current));
    return this.redo.pop();
  }

  clear(){
    this.undo.length = 0;
    this.redo.length = 0;
  }
}
