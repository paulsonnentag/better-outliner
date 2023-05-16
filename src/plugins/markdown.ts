import { MarkdownConfig } from "@lezer/markdown";
import { markdown as baseMarkdown } from "@codemirror/lang-markdown";

const MAP_LITERAL = "{map}";

export const Map: MarkdownConfig = {
  defineNodes: [
    {
      name: "Map",
    },
  ],
  parseInline: [
    {
      name: "Map",
      parse(cx, next, pos) {
        if (
          next != 123 /* { */ ||
          cx.slice(pos, MAP_LITERAL.length + cx.offset) !== MAP_LITERAL
        ) {
          return -1;
        }

        return cx.addElement(cx.elt("Map", pos, pos + MAP_LITERAL.length));
      },
    },
  ],
};

export const markdown = baseMarkdown({
  extensions: [Map],
});

type Extension = { extension: Extension } | readonly Extension[];
