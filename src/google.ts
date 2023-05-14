import { Loader } from "@googlemaps/js-api-loader";

// @ts-ignore
export const GOOGLE_API_KEY = __APP_ENV__.GOOGLE_MAPS_API_KEY;

const loader = new Loader({
  apiKey: GOOGLE_API_KEY,
  version: "beta",
  libraries: ["places", "marker"],
});

export const googleApi = loader.load();

export const placesAutocompleteApi = googleApi.then(
  (google) => new google.maps.places.AutocompleteService()
);

export const placesServiceApi = googleApi.then(
  (google) =>
    new google.maps.places.PlacesService(document.createElement("div"))
);
