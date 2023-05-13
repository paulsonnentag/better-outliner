import { useEffect, useRef, useState } from "react";
import { EditorView, EditorViewConfig, keymap } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState, SelectionRange, Transaction } from "@codemirror/state";
import ReactJson from "react-json-view";
import { useStaticCallback } from "./hooks";
import { functionButtonsGutter } from "./plugins/gutter";
import {
  extractData,
  getNodeAtRange,
  nodesField,
  parseNodes,
  Node,
  setNodes,
} from "./plugins/parser";

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
    const currentEditorView = editorViewRef.current;
    if (!currentEditorView) {
      return;
    }

    const nodes = parseNodes(state);
    nodes.forEach(extractData);
    setParsedNodes(nodes);
    currentEditorView.dispatch({
      effects: setNodes.of(nodes),
    });
  });

  const onUpdateSelection = useStaticCallback((state: EditorState) => {
    const selection = state.selection;

    if (selection.ranges.length !== 1) {
      setFocusedNode(undefined);
      return;
    }

    const range: SelectionRange = selection.ranges[0];
    const node = getNodeAtRange(state.field(nodesField), range.from, range.to);
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
        nodesField,
        markdown(),
        keymap.of([indentWithTab]),
      ],
      dispatch(transaction: Transaction) {
        view.update([transaction]);

        if (transaction.docChanged) {
          onChangeDoc(view.state);
        } else if (
          transaction.selection ||
          transaction.effects.some((effect) => effect.is(setNodes))
        ) {
          onUpdateSelection(view.state);
        }
      },
      parent: containerRef.current,
    } as EditorViewConfig));

    onChangeDoc(view.state);

    return () => {
      view.destroy();
    };
  }, []);

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
