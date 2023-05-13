import { gutter, GutterMarker } from "@codemirror/view";
import { getNodeAtRange, Node, nodesField, setNodes } from "./parser";

export const functionButtonsGutter = gutter({
  class: "w-[20px] px-1",

  lineMarker(view, line): GutterMarker | null {
    const ranges = view.state.selection.ranges;

    if (ranges.length !== 1) {
      return null;
    }

    const range = ranges[0];
    if (!(range.from >= line.from && range.to <= line.to)) {
      return null;
    }

    const nodeAtLine = getNodeAtRange(
      view.state.field(nodesField),
      line.from,
      line.to
    );

    if (!nodeAtLine) {
      return null;
    }

    return new (class extends GutterMarker {
      toDOM(view) {
        if ((nodeAtLine as Node).data.geoPoints) {
          return document.createTextNode("🗺️");
        }

        return document.createTextNode("");
      }
    })();
  },

  lineMarkerChange(update) {
    return update.transactions.some(
      (transaction) =>
        transaction.docChanged ||
        transaction.selection ||
        transaction.effects.some((effect) => effect.is(setNodes))
    );
  },
});
