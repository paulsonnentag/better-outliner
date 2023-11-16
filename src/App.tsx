import { useEffect, useRef, useState } from "react";
import {
  EditorView,
  EditorViewConfig,
  keymap,
  Decoration,
  WidgetType,
} from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import {
  EditorState,
  SelectionRange,
  Transaction,
  StateField,
  StateEffect,
  Range,
} from "@codemirror/state";
import { useStaticCallback } from "./hooks";
import {
  getNodeAtRange,
  OutlineNode,
  outlineTreeField,
  parseOutlineTree,
  setOutlineTree,
} from "./plugins/outlineTree";
import { markdown } from "@codemirror/lang-markdown";

/*
const initialSource = `- Distance
  - Aachen:
    - position: 50.7753, 6.0839
  - Washington:
    - position: 38.9072, 77.0369
  - {distance(lookup("Washington"), lookup("Aachen"))}
`; */

const initialSource = `- Formulas
  - {Math.random()}
  - {1 + 2}
  - {invalid}
`;

class ExpressionResultWidget extends WidgetType {
  constructor(readonly value: string) {
    super();
  }

  eq(other: ExpressionResultWidget) {
    return other.value == this.value;
  }

  toDOM() {
    let dom = document.createElement("span");
    dom.setAttribute("aria-hidden", "true");
    dom.className = "text-blue-500";
    dom.innerText = ` = ${this.value}`;
    return dom;
  }
}

const setRootNodesEffect = StateEffect.define<OutlineNode[]>();
const rootNodesField = StateField.define<OutlineNode[]>({
  create() {
    return [];
  },
  update(rootNodes: OutlineNode[], transaction) {
    for (let e of transaction.effects) {
      if (e.is(setRootNodesEffect)) {
        return e.value;
      }
    }

    return rootNodes;
  },
});

const outlineNodeDecorations = EditorView.decorations.compute(
  [rootNodesField],
  (state) => {
    const rootNodes = state.field(rootNodesField);

    return Decoration.set(rootNodes.flatMap(getDecorationsOfNode));
  }
);

function getDecorationsOfNode(node: OutlineNode): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];

  for (const expression of node.expressions) {
    if (expression.value) {
      decorations.push(
        Decoration.mark({
          class: "text-gray-400 font-semibold",
        }).range(expression.from, expression.to)
      );
      decorations.push(
        Decoration.widget({
          widget: new ExpressionResultWidget(expression.value),
          side: 1,
        }).range(expression.to)
      );
    }
  }

  return decorations.concat(node.children.flatMap(getDecorationsOfNode));
}

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView>();

  const [rootNodes, setRootNodes] = useState<OutlineNode[]>([]);
  const [focusedNode, setFocusedNode] = useState<OutlineNode>();

  useEffect(() => {
    const currentEditorView = editorViewRef.current;
    if (!currentEditorView) {
      return;
    }

    for (const rootNode of rootNodes) {
      evalFormulas(rootNode);
    }

    currentEditorView.dispatch({ effects: setRootNodesEffect.of(rootNodes) });
  }, [rootNodes]);

  const onChangeDoc = useStaticCallback((state: EditorState) => {
    const currentEditorView = editorViewRef.current;
    if (!currentEditorView) {
      return;
    }

    const nodes = parseOutlineTree(state);
    setRootNodes(nodes);
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
        rootNodesField,
        outlineNodeDecorations,
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
      </div>
    </div>
  );
}

function evalFormulas(node: OutlineNode) {
  if (node.expressions) {
    for (const expression of node.expressions) {
      try {
        expression.value = eval(expression.source).toString();
      } catch (err: unknown) {
        expression.value = err.toString();
      }
    }
  }

  node.children.forEach(evalFormulas);
}

export default App;
