import { useEffect, useRef, useState } from "react";
import { EditorView, EditorViewConfig, keymap } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import ReactJson from "react-json-view";

const initialSource = `- Foo
  - Home
    - latLng: 50.775555, 6.083611
  - Bob   
    - age: 30
    - pet:
      - name: Snowball
      - type: cat
      - age: 2
  - lol
`;

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView>();

  const [parsedNodes, setParsedNodes] = useState<Node[]>([]);

  const onChangeEditorState = (state: EditorState) => {
    const nodes = parseNodes(state);
    nodes.forEach(extractData);
    setParsedNodes(nodes);
  };

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const view = (editorViewRef.current = new EditorView({
      doc: initialSource,
      extensions: [
        minimalSetup,
        EditorView.lineWrapping,
        markdown(),
        keymap.of([indentWithTab]),
      ],

      dispatch(transaction) {
        view.update([transaction]);
        if (transaction.docChanged) {
          onChangeEditorState(view.state);
        }
      },
      parent: containerRef.current,
    } as EditorViewConfig));

    onChangeEditorState(view.state);

    return () => {
      view.destroy();
    };
  }, []);

  return (
    <div className="flex p-4">
      <div className="w-full" ref={containerRef}></div>

      <div className="w-full bg-gray-200 p-4 rounded-xl">
        {parsedNodes.map((node, index) => (
          <ReactJson src={node} key={index} collapsed={true} />
        ))}
      </div>
    </div>
  );
}

export default App;

interface Node {
  parent: Node;
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

function parseNodes(state: EditorState): Node[] {
  const parents: Node[] = [];
  let currentNode: Node | undefined = undefined;

  const results: Node[] = [];

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === "ListItem") {
        if (currentNode) {
          parents.unshift(currentNode);
        }

        const bulletSource = state
          .sliceDoc(node.from + 2, node.to)
          .split("\n")[0];

        const parent = parents[0];

        const { key, value } = parseBullet(bulletSource);

        currentNode = {
          key,
          value,
          parent,
          children: [],
          data: {},
          props: {},
        };

        if (parent) {
          if (key !== undefined && value !== undefined && !parent.props[key]) {
            parent.props[key] = currentNode;
          }
          parent.children.push(currentNode);
        }
      }
    },

    leave(node) {
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

  return results;
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

function extractData(node: Node) {
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
