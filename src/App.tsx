import { useEffect, useRef, useState } from "react";
import { EditorView, EditorViewConfig, keymap, gutter } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxTree } from "@codemirror/language";
import { EditorState, Transaction } from "@codemirror/state";
import ReactJson from "react-json-view";
import { useStaticCallback } from "./hooks";
import { functionButtonsGutter } from "./plugins/gutter";

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
  const [focusedNode, setFocusedNode] = useState<Node>();

  const onChangeDoc = useStaticCallback((state: EditorState) => {
    const nodes = parseNodes(state);
    nodes.forEach(extractData);
    setParsedNodes(nodes);
  });

  // update selection if parsedNodes have changed
  useEffect(() => {
    const currentEditor = editorViewRef.current;

    if (currentEditor) {
      onUpdateSelection(currentEditor.state);
    }
  }, [parsedNodes, editorViewRef]);

  const onUpdateSelection = useStaticCallback((state: EditorState) => {
    const selection = state.selection;

    // todo: we should handle selection ranges, but then things become a bit more complicated, so treat this case as if nothing was selected for now
    if (
      selection.ranges.length !== 1 ||
      selection.ranges[0].from !== selection.ranges[0].to
    ) {
      setFocusedNode(undefined);
      return;
    }

    const position = selection.ranges[0].from;
    const node = getNodeAtPosition(parsedNodes, position);
    setFocusedNode(node);
  });

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const view = (editorViewRef.current = new EditorView({
      doc: initialSource,
      extensions: [
        minimalSetup,
        EditorView.lineWrapping,
        functionButtonsGutter,
        markdown(),
        keymap.of([indentWithTab]),
      ],
      dispatch(transaction: Transaction) {
        view.update([transaction]);

        if (transaction.docChanged) {
          onChangeDoc(view.state);
          // onUpdateSelection is called implicitly when the parsed nodes change
        } else if (transaction.selection) {
          onUpdateSelection(view.state);
        }
      },
      parent: containerRef.current,
    } as EditorViewConfig));

    onChangeDoc(view.state);

    return () => {
      view.destroy();
    };
  }, []); // don't need to pass onUpdateSelection and onChangeDoc because they are static callbacks

  return (
    <div className="flex p-4 gap-2 h-screen">
      <div className="w-full">
        <div ref={containerRef}></div>
        {focusedNode && (
          <div>
            {focusedNode.value} {focusedNode.data.geoPoints?.length}
          </div>
        )}
      </div>

      <div className="w-full bg-gray-100 p-4 rounded-xl">
        {parsedNodes.map((node, index) => (
          <ReactJson src={node} key={index} collapsed={true} />
        ))}
      </div>
    </div>
  );
}

export default App;

interface Node {
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
function parseNodes(state: EditorState): Node[] {
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

function getNodeAtPosition(nodes: Node[], position: number): Node | undefined {
  for (const node of nodes) {
    if (position >= node.from && position <= node.to) {
      const childNode = getNodeAtPosition(node.children, position);
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
