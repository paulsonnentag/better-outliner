import { useEffect, useRef, useState } from "react";
import { EditorView, EditorViewConfig, keymap } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { EditorState, SelectionRange, Transaction } from "@codemirror/state";
import ReactJson from "react-json-view";
import { useStaticCallback } from "./hooks";
import { functionButtonsGutter } from "./plugins/gutter";
import {
  extractData,
  getNodeAtRange,
  outlineTree,
  outlineTreeField,
  parseOutlineTree,
  setOutlineTree,
} from "./plugins/outlineTree";
import { mapPlugin } from "./plugins/map";
import { markdown } from "./plugins/markdown";

const initialSource = `- My map
  - {map}
  - New York City
    - latLng: 40.712776, -74.005974
  - Los Angeles
    - latLng: 34.052235, -118.243683
  - London
    - latLng: 51.507350, -0.127758
  - Sydney
    - latLng: -33.868820, 151.209290
  - Tokyo
    - latLng: 35.689487, 139.691711
  - Grand Canyon
    - latLng: 36.106965, -112.112997
  - Mount Everest
    - latLng: 27.988120, 86.925026
  - The Great Barrier Reef
    - latLng: -18.2871, 147.6992
  - Moscow
    - latLng: 55.751244, 37.618423
  - Paris
    - latLng: 48.856613, 2.352222
  - Rome
    - latLng: 41.902783, 12.496365
  - Berlin
    - latLng: 52.520006, 13.404954
  - Yellowstone National Park
    - latLng: 44.4280, -110.5885
  - The Pyramids of Giza
    - latLng: 29.979234, 31.134202
  - Sahara Desert
    - latLng: 25.000000, 0.000000
  - Amazon Rainforest
    - latLng: -3.4653, -62.2159
  - Niagara Falls
    - latLng: 43.096214, -79.037739
  - The Dead Sea
    - latLng: 31.559029, 35.473189
  - The Galapagos Islands
    - latLng: -0.829278, -90.982067
  - Machu Picchu
    - latLng: -13.163068, -72.545128
  - The Great Wall of China
    - latLng: 40.431908, 116.570374
  - Mount Kilimanjaro
    - latLng: -3.075833, 37.353333
  - The Colosseum in Rome
    - latLng: 41.890210, 12.492231
  - The Eiffel Tower
    - latLng: 48.858093, 2.294694
  - The Leaning Tower of Pisa
    - latLng: 43.722952, 10.396597
  - The Louvre Museum
    - latLng: 48.860611, 2.337644
  - The Statue of Liberty
    - latLng: 40.689247, -74.044502
`;

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView>();

  const [parsedNodes, setParsedNodes] = useState<outlineTree[]>([]);
  const [focusedNode, setFocusedNode] = useState<outlineTree>();

  const onChangeDoc = useStaticCallback((state: EditorState) => {
    const currentEditorView = editorViewRef.current;
    if (!currentEditorView) {
      return;
    }

    const nodes = parseOutlineTree(state);
    nodes.forEach(extractData);
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
        functionButtonsGutter,
        outlineTreeField,
        markdown,
        mapPlugin,
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
