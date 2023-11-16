import { useEffect, useRef, useState } from "react";
import { EditorView, EditorViewConfig, keymap } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { EditorState, SelectionRange, Transaction } from "@codemirror/state";
import { useStaticCallback } from "./hooks";
import {
  getNodeAtRange,
  OutlineNode,
  outlineTreeField,
  parseOutlineTree,
  setOutlineTree,
} from "./plugins/outlineTree";
import { markdown } from "@codemirror/lang-markdown";

const initialSource = `- Distance
  - Aachen:
    - position: 50.7753, 6.0839
  - Washington:
    - position: 38.9072, 77.0369
  - {distance(lookup("Washington"), lookup("Aachen"))}
`;

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView>();

  const [parsedNodes, setParsedNodes] = useState<OutlineNode[]>([]);
  const [focusedNode, setFocusedNode] = useState<OutlineNode>();

  useEffect(() => {
    const rootNode = parsedNodes[0];

    if (!rootNode) {
      return;
    }

    console.log(rootNode);
  }, [parsedNodes]);

  const onChangeDoc = useStaticCallback((state: EditorState) => {
    const currentEditorView = editorViewRef.current;
    if (!currentEditorView) {
      return;
    }

    const nodes = parseOutlineTree(state);
    setParsedNodes(nodes);
    currentEditorView.dispatch({
      effects: setOutlineTree.of(nodes),
    });
  });

  const onUpdateSelection = useStaticCallback((state: EditorState) => {
    const selection = state.selection;

    if (selection.ranges.length !== 1) {
      setFocusedNode(undefined);
      return;
    }

    const range: SelectionRange = selection.ranges[0];
    const node = getNodeAtRange(
      state.field(outlineTreeField),
      range.from,
      range.to
    );
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
        outlineTreeField,
        markdown(),
        keymap.of([indentWithTab]),
      ],
      dispatch(transaction: Transaction) {
        view.update([transaction]);

        if (transaction.docChanged) {
          onChangeDoc(view.state);
        } else if (
          transaction.selection ||
          transaction.effects.some((effect) => effect.is(setOutlineTree))
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
        {focusedNode && <div>{focusedNode.value}</div>}
      </div>
    </div>
  );
}

export default App;
