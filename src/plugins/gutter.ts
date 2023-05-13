import { gutter, GutterMarker } from "@codemirror/view";

const emptyMarker: GutterMarker = new (class extends GutterMarker {
  toDOM() {
    return document.createTextNode("➡️");
  }
})();

export const functionButtonsGutter = gutter({
  lineMarker(view, line): GutterMarker | null {
    const ranges = view.state.selection.ranges;

    if (ranges.length !== 1) {
      return null;
    }

    const range = ranges[0];
    if (range.from >= line.from && range.to <= line.to) {
      return emptyMarker;
    }

    return null;
  },

  lineMarkerChange(update) {
    return update.transactions.some(
      (transaction) => transaction.docChanged || transaction.selection
    );
  },

  initialSpacer: () => emptyMarker,
});
