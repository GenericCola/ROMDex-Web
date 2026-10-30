// History records the viewed trail, so native reparenting does not change Back's destination.
export class DetailNavigation {
  constructor() { this.history = []; }
  reset() { this.history = []; }
  open(current, next, fromChild = false) {
    if (!fromChild) this.reset();
    else if (current && current !== next) this.history.push(current);
  }
  destination(byId) {
    while (this.history.length && !byId.has(this.history.at(-1))) this.history.pop();
    return this.history.at(-1) ?? null;
  }
  back(byId) { const id = this.destination(byId); if (id) this.history.pop(); return id; }
  remap(mapping) { this.history = this.history.map(id => mapping[id] || id); }
}

