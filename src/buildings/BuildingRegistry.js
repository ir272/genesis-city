import { eventBus } from '../utils/EventBus.js';

export class BuildingRegistry {
  constructor() {
    this.buildings = new Map();
    this.nextId = 1;
  }

  register(data) {
    const id = this.nextId++;
    const building = {
      id,
      gridX: data.gridX,
      gridY: data.gridY,
      type: data.type,
      mesh: data.mesh,
      builtDay: data.builtDay || 0,
      name: data.name || this._generateName(data.type),
      constructionProgress: 0,
      isConstructing: true,
      decaying: false,
      decayProgress: 0
    };
    this.buildings.set(id, building);
    eventBus.emit('buildingRegistered', building);
    return id;
  }

  get(id) {
    return this.buildings.get(id);
  }

  remove(id) {
    const b = this.buildings.get(id);
    if (b) {
      this.buildings.delete(id);
      eventBus.emit('buildingRemoved', b);
    }
  }

  getAll() {
    return Array.from(this.buildings.values());
  }

  getByType(type) {
    return this.getAll().filter(b => b.type === type);
  }

  getCount() {
    return this.buildings.size;
  }

  getByGrid(gx, gy) {
    return this.getAll().find(b => b.gridX === gx && b.gridY === gy);
  }

  _generateName(type) {
    const prefixes = {
      cottage: ['Humble', 'Quiet', 'Small', 'Old', 'Mossy'],
      manor: ['Goldsworth', 'Ironvale', 'Thornfield', 'Ashmore', 'Blackwood'],
      cathedral: ['The Grand Cathedral', 'Cathedral of Light', 'The Ancient Abbey'],
      mill: ['Windmill', 'The Old Mill', 'Millstone'],
      blacksmith: ["Forge", "The Anvil", "Iron Works", "Smith's Hearth"],
      inn: ['The Golden Stag', 'The Rusty Mug', 'The Wanderer', 'The Red Lion', 'The Sleeping Bear'],
      farm: ['Wheatfield Farm', 'Green Pastures', 'The Homestead', 'Barley Farm'],
      guild_hall: ['Merchant Guild', 'Trade Hall', 'The Guild House']
    };
    const options = prefixes[type] || ['Building'];
    return options[Math.floor(Math.random() * options.length)];
  }
}
