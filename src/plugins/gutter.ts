import { gutter, GutterMarker } from "@codemirror/view";
import {
  getNodeAtRange,
  outlineTree,
  outlineTreeField,
  setOutlineTree,
} from "./outlineTree";

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
      view.state.field(outlineTreeField),
      line.from,
      line.to
    );

    if (!nodeAtLine) {
      return null;
    }

    return new (class extends GutterMarker {
      toDOM(view) {
        if ((nodeAtLine as outlineTree).data.geoPoints) {
          const node = document.createElement("div");
          node.innerText = "🗺️";
          node.className = "cursor-pointer";
          return node;
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
        transaction.effects.some((effect) => effect.is(setOutlineTree))
    );
  },

  domEventHandlers: {
    mousedown: (view, line) => {
      console.log("click");

      const lineText = view.state.sliceDoc(line.from, line.to);
      const indentation = lineText.slice(
        0,
        lineText.length - lineText.trimStart().length
      );

      view.dispatch(
        view.state.update({
          changes: {
            from: line.to,
            to: line.to,
            insert: `\n${indentation}  - {map}`,
          },
        })
      );

      return true;
    },
  },
});
