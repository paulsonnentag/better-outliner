import {
  Decoration,
  DecorationSet,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";

class MapWidget extends WidgetType {
  constructor() {
    super();
  }

  eq(other: MapWidget) {
    return true;
  }

  toDOM() {
    const container = document.createElement("span");
    container.className =
      "w-[500px] h-[300px] rounded-xl bg-gray-100 inline-block";

    return container;
  }

  ignoreEvent() {
    return false;
  }
}

export const MAP_TOKEN_REGEX = /\{map}/g;

const mapTokenMatcher = new MatchDecorator({
  regexp: MAP_TOKEN_REGEX,
  decoration: (match) =>
    Decoration.replace({
      widget: new MapWidget(),
    }),
});

export const mapTokenPlugin = ViewPlugin.fromClass(
  class {
    mapTokens: DecorationSet;

    constructor(view: EditorView) {
      this.mapTokens = mapTokenMatcher.createDeco(view);
    }

    update(update: ViewUpdate) {
      this.mapTokens = mapTokenMatcher.updateDeco(update, this.mapTokens);
    }
  },
  {
    decorations: (instance) => instance.mapTokens,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => {
        return view.plugin(plugin)?.mapTokens || Decoration.none;
      }),
  }
);
