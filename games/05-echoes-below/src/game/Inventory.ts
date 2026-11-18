import { HOTBAR_SIZE, INVENTORY_SIZE, type Station } from './constants';
import { ITEMS, RECIPES } from './data/items';
import type { Recipe, Stack } from './types';

export class Inventory {
  slots: Array<Stack | null>;
  selected = 0;

  constructor(saved?: Array<Stack | null>) {
    this.slots = Array.from({ length: INVENTORY_SIZE }, (_, i) => {
      const stack = saved?.[i]; const def = stack ? ITEMS[stack.id] : undefined;
      if (!stack || !def || !Number.isFinite(stack.qty) || stack.qty <= 0) return null;
      return { id: stack.id, qty: Math.min(def.maxStack, Math.floor(stack.qty)) };
    });
    if (!saved) {
      this.add('copperPick', 1);
      this.add('axe', 1);
      this.add('shortsword', 1);
      this.add('dirt', 25);
      this.add('wood', 12);
      this.add('torch', 8);
      this.add('potion', 3);
      this.add('arrow', 30);
    }
  }

  get selectedStack() { return this.slots[this.selected]; }
  get selectedItem() { return this.selectedStack ? ITEMS[this.selectedStack.id] : undefined; }

  count(id: string) {
    return this.slots.reduce((sum, stack) => sum + (stack?.id === id ? stack.qty : 0), 0);
  }

  add(id: string, qty: number) {
    const def = ITEMS[id];
    if (!def || qty <= 0) return false;
    if (!this.hasSpaceFor(id, qty)) return false;
    let remaining = qty;
    for (const stack of this.slots) {
      if (stack?.id === id && stack.qty < def.maxStack) {
        const moved = Math.min(remaining, def.maxStack - stack.qty);
        stack.qty += moved;
        remaining -= moved;
        if (!remaining) return true;
      }
    }
    for (let i = 0; i < this.slots.length && remaining; i++) {
      if (!this.slots[i]) {
        const moved = Math.min(remaining, def.maxStack);
        this.slots[i] = { id, qty: moved };
        remaining -= moved;
      }
    }
    return remaining === 0;
  }

  remove(id: string, qty: number) {
    if (this.count(id) < qty || qty <= 0) return false;
    let remaining = qty;
    for (let i = this.slots.length - 1; i >= 0 && remaining; i--) {
      const stack = this.slots[i];
      if (stack?.id === id) {
        const taken = Math.min(stack.qty, remaining);
        stack.qty -= taken;
        remaining -= taken;
        if (stack.qty <= 0) this.slots[i] = null;
      }
    }
    return true;
  }

  removeSelected(qty = 1) {
    const stack = this.selectedStack;
    if (!stack || stack.qty < qty) return false;
    stack.qty -= qty;
    if (stack.qty <= 0) this.slots[this.selected] = null;
    return true;
  }

  canCraft(recipe: Recipe, nearby: Station[]) {
    return (recipe.station === 'hand' || nearby.includes(recipe.station))
      && recipe.ingredients.every((part) => this.count(part.id) >= part.qty)
      && this.hasSpaceFor(recipe.output.id, recipe.output.qty);
  }

  craft(recipeId: string, nearby: Station[]) {
    const recipe = RECIPES.find((candidate) => candidate.id === recipeId);
    if (!recipe || !this.canCraft(recipe, nearby)) return false;
    recipe.ingredients.forEach((part) => this.remove(part.id, part.qty));
    this.add(recipe.output.id, recipe.output.qty);
    return true;
  }

  hasSpaceFor(id: string, qty: number) {
    const def = ITEMS[id];
    const capacity = this.slots.reduce((sum, stack) => {
      if (!stack) return sum + def.maxStack;
      return sum + (stack.id === id ? def.maxStack - stack.qty : 0);
    }, 0);
    return capacity >= qty;
  }

  select(index: number) {
    this.selected = ((index % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
  }
}
