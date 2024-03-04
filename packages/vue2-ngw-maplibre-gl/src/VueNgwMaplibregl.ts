import 'maplibre-gl/dist/maplibre-gl.css';

import MapAdapter from '@nextgis/maplibre-gl-map-adapter';
import { VueNgwMap } from '@nextgis/vue2-ngw-map';
import { Component, Mixins, Prop } from 'vue-property-decorator';

import type { Map } from 'maplibre-gl';

@Component
export class VueNgwMaplibregl extends Mixins<VueNgwMap<Map>>(VueNgwMap) {
  @Prop({ type: Function, default: () => new MapAdapter() })
  mapAdapter!: () => MapAdapter;
  // ngwMap!: NgwMap<Map>;
}
