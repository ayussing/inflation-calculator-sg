"use client";

import type { CpiSeries } from "@/lib/cpi/schema";
import { DIVISION_LEVEL } from "@/lib/cpi/constants";

function buildChildrenByParent(categories: CpiSeries[]): Map<number, CpiSeries[]> {
  const map = new Map<number, CpiSeries[]>();
  for (const category of categories) {
    if (category.parentId === null) continue;
    const siblings = map.get(category.parentId) ?? [];
    siblings.push(category);
    map.set(category.parentId, siblings);
  }
  return map;
}

function TreeNode({
  node,
  childrenByParent,
  selected,
  onToggle,
  maxSelected,
}: {
  node: CpiSeries;
  childrenByParent: Map<number, CpiSeries[]>;
  selected: Set<string>;
  onToggle: (code: string) => void;
  maxSelected: number;
}) {
  const children = childrenByParent.get(node.id) ?? [];
  const isSelected = selected.has(node.code);
  const atCap = selected.size >= maxSelected && !isSelected;

  return (
    <li>
      <label
        className={`flex items-center gap-2 text-sm ${atCap ? "opacity-50" : ""}`}
        title={atCap ? `You can compare up to ${maxSelected} categories at a time` : undefined}
      >
        <input
          type="checkbox"
          checked={isSelected}
          disabled={atCap}
          onChange={() => onToggle(node.code)}
          className="h-4 w-4 rounded border-panel-border"
        />
        {node.name}
      </label>
      {children.length > 0 && (
        <ul className="ml-5 mt-1 space-y-1 border-l border-panel-border pl-3">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              childrenByParent={childrenByParent}
              selected={selected}
              onToggle={onToggle}
              maxSelected={maxSelected}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CategoryTree({
  categories,
  selected,
  onToggle,
  maxSelected,
}: {
  categories: CpiSeries[];
  selected: Set<string>;
  onToggle: (code: string) => void;
  maxSelected: number;
}) {
  const childrenByParent = buildChildrenByParent(categories);
  const topLevel = categories.filter((c) => c.level === DIVISION_LEVEL);

  return (
    <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
      {topLevel.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          childrenByParent={childrenByParent}
          selected={selected}
          onToggle={onToggle}
          maxSelected={maxSelected}
        />
      ))}
    </ul>
  );
}
