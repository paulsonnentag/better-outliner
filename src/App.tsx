import { useEffect, useRef } from "react";
import { EditorView, EditorViewConfig, keymap } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";

const initialSource = `- Foo
  -bar
  -baz
    - more
  -lol
`;

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView>();

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
      parent: containerRef.current,
    } as EditorViewConfig));

    return () => {
      view.destroy();
    };
  }, []);

  return <div ref={containerRef}></div>;
}

export default App;
