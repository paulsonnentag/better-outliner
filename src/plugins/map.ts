import { Extension, Facet, Range } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  WidgetType,
} from "@codemirror/view";
import { GeoPoint, outlineTree, outlineTreeField } from "./outlineTree";
import { googleApi } from "../google";
import { v4 } from "uuid";

class MapWidget extends WidgetType {
  private mapId = v4();
  private map: google.maps.Map;
  private markers: google.maps.marker.AdvancedMarkerElement[] = [];

  constructor(private geoPoints: GeoPoint[]) {
    super();
  }

  eq(other: MapWidget) {
    // copy over properties to new instance, so it has references to the existing markers and map
    // that way we can reuse the existing map
    other.markers = this.markers;
    other.map = this.map;
    return false;
  }

  updateDOM(dom: HTMLElement, view: EditorView): boolean {
    this.refreshMarkers();
    return true;
  }

  private refreshMarkers() {
    const totalMarkers = this.markers.length;
    const totalGeopoints = this.geoPoints.length;
    const markersToDelete = totalMarkers - totalGeopoints;

    if (markersToDelete > 0) {
      for (let i = 0; i < markersToDelete; i++) {
        const marker = this.markers.pop();
        marker.map = null;
      }
    }

    for (let i = 0; i < totalGeopoints; i++) {
      const geoPoint = this.geoPoints[i];
      let marker = this.markers[i];

      if (!marker) {
        const element = document.createElement("div");
        element.className =
          "w-[16px] h-[16px] rounded-full cursor-pointer bg-red-500 border-red-700";
        element.style.transform = `translate(0, 8px)`;
        marker = new google.maps.marker.AdvancedMarkerView({
          map: this.map,
          content: element,
          position: geoPoint.position,
        });

        this.markers.push(marker);
      }

      if (
        marker.position!.lat !== geoPoint.position.lat ||
        marker.position?.lng !== marker.position!.lat
      ) {
        marker.position = geoPoint.position;
      }
    }
  }

  toDOM() {
    const container = document.createElement("span");
    container.className =
      "w-[500px] h-[300px] rounded-xl bg-gray-100 inline-block overflow-hidden";

    googleApi.then(() => {
      this.map = new google.maps.Map(container, {
        zoom: 11,
        mapId: this.mapId, // id is required when using AdvancedMarkerView
        center: { lat: 50.775555, lng: 6.083611 },
        disableDefaultUI: true,
        gestureHandling: "greedy",
      });

      this.map.fitBounds(
        getMinBounds(this.geoPoints.map((geoPoint) => geoPoint.position))
      );

      this.refreshMarkers();
    });

    return container;
  }

  ignoreEvent() {
    return false;
  }
}

function getMinBounds(
  points: google.maps.LatLngLiteral[]
): google.maps.LatLngBounds {
  const bounds = new google.maps.LatLngBounds();
  for (const point of points) {
    bounds.extend(point);
  }

  return bounds;
}

function extractMapDecorationsInOutlineTree(
  tree: outlineTree,
  decorations: Range<Decoration>[]
) {
  for (const mapToken of tree.mapTokens) {
    decorations.push(
      Decoration.replace({
        widget: new MapWidget((tree.parent ?? tree).data.geoPoints ?? []),
      }).range(mapToken.from, mapToken.to)
    );
  }

  tree.children.forEach((childTree) =>
    extractMapDecorationsInOutlineTree(childTree, decorations)
  );
}

export const mapPlugin = EditorView.decorations.compute(
  [outlineTreeField],
  (state) => {
    const decorations: Range<Decoration>[] = [];
    const outlineTree = state.field(outlineTreeField)[0];

    if (!outlineTree) {
      return Decoration.none;
    }

    extractMapDecorationsInOutlineTree(outlineTree, decorations);
    return Decoration.set(decorations);
  }
);
