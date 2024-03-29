import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
export const setOutlineTree = StateEffect.define<OutlineNode[]>();
export const outlineTreeField = StateField.define<OutlineNode[]>({
  create() {
    return [];
  },
  update(nodes, tr) {
    for (let e of tr.effects) {
      if (e.is(setOutlineTree)) {
        return e.value;
      }
    }

    return nodes;
  },
});

export interface OutlineNode {
  key?: string;
  value: string;
  expressions: Expression[];
  children: OutlineNode[];
  parent?: OutlineNode;

  from: number;
  to: number;
  indentation: number;

  data: Record<string, any>; // store arbitrary data
}

export interface Expression {
  from: number;
  to: number;
  source: string;
  value?: string;
  css?: string; // add custom css class that will be applied to the expression
}

// todo: doesn't work if there are multiple separate lists in the document
export function parseOutlineTree(state: EditorState): OutlineNode[] {
  const parents: OutlineNode[] = [];
  let currentNode: OutlineNode | undefined = undefined;

  const results: OutlineNode[] = [];

  syntaxTree(state).iterate({
    enter(node) {
      // console.log("enter", node.name, state.doc.lineAt(node.from));

      switch (node.name) {
        case "BulletList":
          if (parents.length === 0) {
            parents.unshift({
              value: "",
              expressions: [],
              indentation: 0,
              from: node.from,
              to: node.to,
              children: [],
              data: {},
            });
          }
          break;

        case "ListItem": {
          if (currentNode) {
            parents.unshift(currentNode);
          }

          const bulletSource = state
            .sliceDoc(node.from + 2, node.to)
            .split("\n")[0];

          const parent = parents[0];

          const { key, value, expressions } = parseBullet(
            bulletSource,
            node.from + 2
          );

          const from = state.doc.lineAt(node.from).from;

          console.log(bulletSource, node.from - from);

          currentNode = {
            from, // use the start position of the line
            indentation: node.from - from,
            to: node.to,
            key,
            value,
            children: [],
            expressions,
            parent,
            data: {},
          };

          if (parent) {
            parent.children.push(currentNode);
          }
        }
      }
    },

    leave(node) {
      // console.log("leave", node.name, state.doc.lineAt(node.from));

      switch (node.name) {
        case "ListItem":
          currentNode = undefined;
          break;

        case "BulletList":
          currentNode = parents.shift();

          if (parents.length === 0 && currentNode) {
            results.push(currentNode);
          }
      }
    },
  });

  if (parents.length === 1) {
    results.push(parents[0]);
  }

  return results;
}

export function getNodeAtRange(
  nodes: OutlineNode[],
  from: number,
  to: number
): OutlineNode | undefined {
  for (const node of nodes) {
    if (from >= node.from && to <= node.to) {
      const childNode = getNodeAtRange(node.children, from, to);
      return childNode ? childNode : node;
    }
  }
}

interface Bullet {
  key?: string;
  value: string;
  expressions: Expression[];
}

const KEY_REGEX = /(^[^{]*?):/;

function parseBullet(value: string, offset: number): Bullet {
  const match = value.match(KEY_REGEX);

  if (match) {
    const key = match[1];

    return {
      key: key.trim(),
      value: value.slice(key.length + 1).trim(),
      expressions: parseExpressions(value, offset),
    };
  }

  return {
    value,
    expressions: parseExpressions(value, offset),
  };
}

function parseExpressions(value: string, offset: number = 0): Expression[] {
  const expressions = [];

  const EXPRESSION_REGEX = /{(?<source>[^}]+)}/g;

  for (const match of value.matchAll(EXPRESSION_REGEX)) {
    expressions.push({
      from: (match as any).index + offset,
      to: (match as any).index + match[0].length + offset,
      source: (match as any).groups.source,
    });
  }

  return expressions;
}
