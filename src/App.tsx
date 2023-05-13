import { useEffect, useRef, useState } from "react";
import { EditorView, EditorViewConfig, keymap } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";

const initialSource = `- Foo
  - bar
  - baz
    - more
  - lol
`;

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView>();

  const [parsedNodes, setParsedNodes] = useState<Node[]>([]);

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
          setParsedNodes(parseNodes(view.state));
        }
      },
      parent: containerRef.current,
    } as EditorViewConfig));

    setParsedNodes(parseNodes(view.state));

    return () => {
      view.destroy();
    };
  }, []);

  return (
    <div className="flex p-4">
      <div className="w-full" ref={containerRef}></div>

      <div className="w-full bg-gray-200 p-4 rounded-xl">
        {parsedNodes.map((node, index) => (
          <pre key={index}>
            {JSON.stringify(removeCircularReferences(node), null, 2)}
          </pre>
        ))}
      </div>
    </div>
  );
}

export default App;

interface Node {
  parent: Node;
  value: string;
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

        const value = state.sliceDoc(node.from + 2, node.to).split("\n")[0];

        const parent = parents[0];

        currentNode = {
          parent,
          value,
          children: [],
        };

        if (parent) {
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

type NodeWithoutCircularReferences = Omit<Node, "parent" | "children"> & {
  parent: string | undefined;
  children: NodeWithoutCircularReferences[];
};

function removeCircularReferences(
  node: Node,
  deleteParent = true
): NodeWithoutCircularReferences {
  return {
    ...node,
    parent: node.parent && !deleteParent ? node.parent.value : undefined,
    children: node.children.map((child) =>
      removeCircularReferences(child, deleteParent)
    ),
  };
}
