import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

export const setNodes = StateEffect.define<Node[]>();
export const nodesField = StateField.define<Node[]>({
  create() {
    return [];
  },
  update(nodes, tr) {
    for (let e of tr.effects) {
      if (e.is(setNodes)) {
        return e.value;
      }
    }

    return nodes;
  },
});

export interface Node {
  from: number;
  to: number;
  parent?: Node;
  value?: string;
  key?: string;
  props: { [key: string]: Node };
  data: {
    latLng?: LatLng;
    number?: number;
    geoPoints?: GeoPoint[];
  };
  children: Node[];
}

// todo: doesn't work if there are multiple separate lists in the document
export function parseNodes(state: EditorState): Node[] {
  const parents: Node[] = [];
  let currentNode: Node | undefined = undefined;

  const results: Node[] = [];

  syntaxTree(state).iterate({
    enter(node) {
      // console.log("enter", node.name, state.doc.lineAt(node.from));

      switch (node.name) {
        case "BulletList":
          if (parents.length === 0) {
            parents.unshift({
              from: node.from,
              to: node.to,
              children: [],
              data: {},
              props: {},
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

          const { key, value } = parseBullet(bulletSource);

          currentNode = {
            from: state.doc.lineAt(node.from).from, // use the start position of the line
            to: node.to,
            key,
            value,
            parent,
            children: [],
            data: {},
            props: {},
          };

          if (parent) {
            if (
              key !== undefined &&
              value !== undefined &&
              !parent.props[key]
            ) {
              parent.props[key] = currentNode;
            }
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
  nodes: Node[],
  from: number,
  to: number
): Node | undefined {
  for (const node of nodes) {
    if (from >= node.from && to <= node.to) {
      const childNode = getNodeAtRange(node.children, from, to);
      return childNode ? childNode : node;
    }
  }
}

const LAT_LNG_REGEX = /^\s*(-?\d+\.\d+?),\s*(-?\d+\.\d+?)\s*$/;
const NUMBER_REGEX = /^\s*(-?\d+(\.\d+)?)\s*$/;

interface LatLng {
  lat: number;
  lng: number;
}

interface GeoPoint {
  node: Node;
  position: LatLng;
}

export function extractData(node: Node) {
  if (node.value) {
    const latLngMatch = node.value.match(LAT_LNG_REGEX);
    if (latLngMatch) {
      const [lat, lng] = latLngMatch;
      node.data.latLng = { lat: parseFloat(lat), lng: parseFloat(lng) };
    }

    const numberMatch = node.value.match(NUMBER_REGEX);
    if (numberMatch) {
      const number = numberMatch[1];
      node.data.number = parseFloat(number);
    }
  }

  node.children.forEach(extractData);

  const geoPoints: GeoPoint[] = [];

  for (const child of node.children) {
    if (child.data.latLng) {
      geoPoints.push({ node, position: child.data.latLng });
    }
  }

  node.children.forEach((child) => {
    if (child.data.geoPoints) {
      geoPoints.push(...child.data.geoPoints);
    }
  });

  if (geoPoints.length > 0) {
    node.data.geoPoints = geoPoints;
  }
}

interface Bullet {
  key?: string;
  value?: string;
}

const KEY_REGEX = /(^[^{]*?):/;

function parseBullet(value: string): Bullet {
  const match = value.match(KEY_REGEX);

  if (match) {
    const key = match[1];

    return {
      key: key.trim(),
      value: value.slice(key.length + 1),
    };
  }

  return { value };
}
