export class UndoRedo {
  constructor(){ this.stack=[]; this.index=-1; }
  push(state){
    this.stack = this.stack.slice(0, this.index+1);
    this.stack.push(JSON.stringify(state));
    this.index = this.stack.length-1;
  }
  undo(){ if(this.index>0){ this.index--; return JSON.parse(this.stack[this.index]); } return null; }
  redo(){ if(this.index < this.stack.length-1){ this.index++; return JSON.parse(this.stack[this.index]); } return null; }
}
