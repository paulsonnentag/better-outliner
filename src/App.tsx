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
} from "./outlineTree";
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
  - bob: 
    - age: 10
  - a: 20
  - {Math.random()}
  - {1 + 2}
  - {lookup("bob.age")}
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

  if (node.key) {
    const from = node.from + node.indentation;

    decorations.push(
      Decoration.mark({
        class: "text-gray-500",
      }).range(from, from + node.key.length + 4)
    );
  }

  for (const expression of node.expressions) {
    decorations.push(
      Decoration.mark({
        class: "text-gray-500",
      }).range(expression.from, expression.to)
    );

    if (expression.value) {
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
      evalOutline(rootNode);
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

function evalOutline(rootNode: OutlineNode) {
  addAttributes(rootNode);
  evalFormulas(rootNode);
}

function addAttributes(node: OutlineNode) {
  const attrs: Record<string, OutlineNode> = (node.data.attrs = {});

  for (const child of node.children) {
    if (child.key) {
      attrs[child.key] = child;
    }

    addAttributes(child);
  }
}

function evalFormulas(node: OutlineNode) {
  if (node.expressions) {
    for (const expression of node.expressions) {
      try {
        const fn = new Function(
          "FUNCTIONS",
          "node",
          `       
          const BOUND_FUNCTIONS = {}
          for (const [name, fn] of Object.entries(FUNCTIONS)) {
            BOUND_FUNCTIONS[name] = fn.bind(node)
          }

          with (BOUND_FUNCTIONS) {
            return ${expression.source}
          }
        `
        );

        expression.value = fn(FUNCTIONS, node);
      } catch (err: unknown) {
        expression;
      }
    }
  }

  node.children.forEach(evalFormulas);
}

const FUNCTIONS = {
  lookup(path: string) {
    let current: any = this;

    const parts = path.split(".");
    for (const key of parts) {
      // check own attribute
      let value = current.data.attrs[key];

      // check parent
      if (!value) {
        do {
          current = current.parent;
          value = current.data.attrs[key];
        } while (!value && current.parent);
      }

      if (value) {
        current = value;
      } else {
        return;
      }
    }

    if (current) {
      if (current.expressions.length !== 0) {
        return current.expressions[0].value;
      }

      const number = parseFloat(current.value);
      return isNaN(number) ? current.value : number;
    }
  },
};

export default App;
