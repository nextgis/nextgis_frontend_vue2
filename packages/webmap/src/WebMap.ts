import { MapOptions, AppOptions, GetAttributionsOptions } from './interfaces/WebMapApp';
import { LayerExtent, Pixel, Type, Cursor } from './interfaces/BaseTypes';
import { StarterKit } from './interfaces/StarterKit';
import { AdapterOptions, DataLayerFilter, VectorLayerAdapter, LayerAdapters } from './interfaces/LayerAdapter';
import { Keys } from './components/keys/Keys';
import { EventEmitter } from 'events';
import { MapAdapter, MapClickEvent, ControlPositions, FitOptions } from './interfaces/MapAdapter';
import { RuntimeParams } from './interfaces/RuntimeParams';
import { deepmerge } from './utils/lang';
import { LayerAdaptersOptions, LayerAdapter, OnLayerClickOptions } from './interfaces/LayerAdapter';
import {
  MapControl,
  MapControls,
  CreateControlOptions,
  CreateButtonControlOptions,
  CreateToggleControlOptions
} from './interfaces/MapControl';
import { onLoad } from './utils/decorators';
import { Feature, GeoJsonObject } from 'geojson';

interface Arglist {
  [index: number]: any;
  0: string;
}

export interface LayerMem<L = any, M = any, O extends AdapterOptions = AdapterOptions> {
  id: string;
  layer: L;
  onMap: boolean;
  order?: number;
  baseLayer?: boolean;
  adapter: LayerAdapter<M, L, O>;
}

export class WebMap<M = any, L = any, C = any> {

  options: MapOptions = {};

  displayProjection = 'EPSG:3857';
  lonlatProjection = 'EPSG:4326';

  emitter = new EventEmitter();
  keys: Keys = new Keys(); // TODO: make injectable cached
  mapAdapter: MapAdapter<M>;
  runtimeParams: RuntimeParams[] = [];

  _eventsStatus: { [eventName: string]: boolean } = {};

  private DPI = 1000 / 39.37 / 0.28;
  private IPM = 39.37;

  private _starterKits: StarterKit[];
  private _baseLayers: string[] = [];
  private _layers: { [x: string]: LayerMem } = {};
  private _layersIds: number = 1;
  private _selectedLayers: string[] = [];
  private _extent?: [number, number, number, number];

  constructor(appOptions: AppOptions) {
    this.mapAdapter = appOptions.mapAdapter;
    this._starterKits = appOptions.starterKits || [];

    this._addEventsListeners();
  }

  async create(options: MapOptions): Promise<this> {
    this.options = deepmerge(this.options || {}, options);
    await this._setupMap();
    return this;
  }

  getContainer(): HTMLElement | undefined {
    if (this.mapAdapter.getContainer) {
      return this.mapAdapter.getContainer();
    } else if (this.options.target) {
      if (this.options.target instanceof HTMLElement) {
        return this.options.target;
      } else if (typeof this.options.target === 'string') {
        const element = document.getElementById(this.options.target);
        if (element) {
          return element;
        }
      }
    }
  }

  setCursor(cursor: Cursor) {
    if (this.mapAdapter.setCursor) {
      this.mapAdapter.setCursor(cursor);
    }
  }

  // region MapAdapter methods
  onMapLoad(cb?: any): Promise<void> {
    const mapAdapterOnLoad = this.mapAdapter.onMapLoad;
    if (mapAdapterOnLoad) {
      return mapAdapterOnLoad.call(this.mapAdapter, cb);
    }
    return Promise.resolve(cb);
  }

  async addBaseLayer(
    provider: keyof LayerAdaptersOptions | Type<LayerAdapter>,
    options?: any): Promise<LayerAdapter> {

    const layer = await this.addLayer(provider, {
      maxZoom: this.options.maxZoom,
      minZoom: this.options.minZoom,
      ...options
    }, true);
    if (layer && layer.name) {
      this._baseLayers.push(layer.name);
    }
    return layer;
  }

  isBaseLayer(layerName: string): boolean {
    return this._baseLayers.indexOf(layerName) !== -1;
  }

  setCenter(lngLat: [number, number]): this {
    this.mapAdapter.setCenter(lngLat);
    return this;
  }

  setZoom(zoom: number): this {
    this.mapAdapter.setZoom(zoom);
    return this;
  }

  getZoom(): number | undefined {
    return this.mapAdapter.getZoom();
  }

  setView(lngLat?: [number, number], zoom?: number) {
    if (this.mapAdapter.setView && lngLat && zoom) {
      this.mapAdapter.setView(lngLat, zoom);
    } else {
      if (lngLat) {
        this.mapAdapter.setCenter(lngLat);
      }
      if (zoom) {
        this.mapAdapter.setZoom(zoom);
      }
    }
  }

  // [extent_left, extent_bottom, extent_right, extent_top];
  fit(e: LayerExtent, options?: FitOptions): this {
    this.mapAdapter.fit(e, options);
    return this;
  }

  async fitLayer(layerId: string) {
    const layer = this.getLayer(layerId);
    if (layer && layer.adapter.getExtent) {
      const extent = await layer.adapter.getExtent();
      if (extent) {
        this.fit(extent);
      }
    }
  }

  getLayerAdapters(): { [name: string]: Type<LayerAdapter> } {
    return this.mapAdapter.layerAdapters;
  }

  getLayerAdapter(name: string): Type<LayerAdapter> {
    return this.mapAdapter.layerAdapters[name];
  }

  getLayer(layerName: string): LayerMem {
    return this._layers[layerName];
  }

  getLayers(): string[] {
    return Object.keys(this._layers);
  }

  isLayerOnTheMap(layerName: string): boolean {
    const layerMem = this._layers[layerName];
    return layerMem && layerMem.onMap;
  }

  @onLoad('build-map')
  createControl(control: MapControl, options?: CreateControlOptions): C | undefined {
    if (this.mapAdapter.createControl) {
      return this.mapAdapter.createControl(control, options);
    }
  }

  @onLoad('build-map')
  createButtonControl(options: CreateButtonControlOptions) {
    if (this.mapAdapter.createButtonControl) {
      return this.mapAdapter.createButtonControl(options);
    }
  }

  @onLoad('build-map')
  createToggleControl(options: CreateToggleControlOptions) {
    if (this.mapAdapter.createToggleControl) {
      return this.mapAdapter.createToggleControl(options);
    }
  }

  removeControl(control: any) {
    if (control.remove) {
      control.remove();
    } else if (this.mapAdapter.removeControl) {
      this.mapAdapter.removeControl(control);
    }
  }

  getControl<K extends keyof MapControls>(control: K, options?: MapControls[K]): C | undefined {
    const engine = this.mapAdapter.controlAdapters[control];
    if (engine) {
      return new engine(options);
    }
  }

  async addControl<K extends keyof MapControls>(
    controlDef: K | C,
    position: ControlPositions,
    options?: MapControls[K]) {

    let control: C | undefined;
    if (typeof controlDef === 'string') {
      control = this.getControl(controlDef, options);
    } else {
      control = controlDef as C;
    }
    if (control) {
      const _control = await control;
      return this.mapAdapter.addControl(_control, position);
    }
  }

  async addLayer<K extends keyof LayerAdaptersOptions, O extends AdapterOptions = AdapterOptions>(
    adapter: K | Type<LayerAdapters[K]>,
    options: O | LayerAdaptersOptions[K] = {},
    baselayer?: boolean): Promise<LayerAdapter> {

    let adapterEngine: Type<LayerAdapter>;
    if (typeof adapter === 'string') {
      adapterEngine = this.getLayerAdapter((adapter as string));
    } else {
      adapterEngine = adapter as Type<LayerAdapter>;
    }
    if (adapterEngine) {
      options.onLayerClick = (e) => this._onLayerClick(e);
      const _adapter = new adapterEngine(this.mapAdapter.map, options);
      const order = this._layersIds++;
      await this.onMapLoad();

      const layer = await _adapter.addLayer(options);

      const layerId = _adapter.name;
      if (layerId) {
        const layerOpts: LayerMem = { id: layerId, layer, adapter: _adapter, onMap: false };
        if (baselayer) {
          layerOpts.baseLayer = true;
          layerOpts.order = 0;
          this._baseLayers.push(layerId);
        } else {
          layerOpts.order = options.order || order;
        }
        this._layers[layerId] = layerOpts;

        if (options.visibility) {
          this.showLayer(layerId);
        }
      }

      return _adapter;

    }
    return Promise.reject('No adapter');
  }

  removeLayers() {
    for (const l in this._layers) {
      if (this._layers.hasOwnProperty(l)) {
        this.removeLayer(l);
      }
    }
    this._layers = {};
  }

  removeLayer(layerName: string) {
    const layerMem = this._layers[layerName];
    if (layerMem) {
      this.mapAdapter.removeLayer(layerMem.layer);
      if (layerMem.baseLayer) {
        const index = this._baseLayers.indexOf(layerName);
        if (index) {
          this._baseLayers.splice(index, 1);
        }
      }
      delete this._layers[layerName];
    }
  }

  showLayer(layer: string | LayerAdapter) {
    if (typeof layer === 'string') {
      this.toggleLayer(layer, true);
    } else if (layer.name) {
      this.toggleLayer(layer.name, true);
    }
  }

  hideLayer(layer: string | LayerAdapter) {
    if (typeof layer === 'string') {
      this.toggleLayer(layer, false);
    } else if (layer.name) {
      this.toggleLayer(layer.name, false);
    }
  }

  setLayerOpacity(layerName: string, value: number) {
    if (this.mapAdapter.setLayerOpacity) {
      const layer = this.getLayer(layerName);
      if (layer) {
        this.mapAdapter.setLayerOpacity(layer.layer, value);
      }
    }
  }

  getScaleForResolution(res: number, mpu: number): number {
    return res * (mpu * this.IPM * this.DPI);
  }

  getResolutionForScale(scale: number, mpu: number): number {
    return scale / (mpu * this.IPM * this.DPI);
  }

  toggleLayer(layerName: string, status?: boolean) {
    const layer = this._layers[layerName];

    const toStatus = status !== undefined ? status : !layer.onMap;

    const action = (source: any, l: LayerMem) => {
      l.onMap = toStatus;
      if (toStatus && source) {
        const order = l.baseLayer ? 0 : l.order;
        if (l.adapter && l.adapter.showLayer) {
          l.adapter.showLayer.call(l.adapter, l.layer);
        } else {
          this.mapAdapter.showLayer(l.layer);
        }
        if (order !== undefined) {
          this.mapAdapter.setLayerOrder(l.layer, order, this._layers);
        }
      } else {
        if (l.adapter && l.adapter.hideLayer) {
          l.adapter.hideLayer.call(l.adapter, l.layer);
        } else {
          this.mapAdapter.hideLayer(l.layer);
        }
      }
    };
    if (layer && layer.onMap !== toStatus) {
      if (this.mapAdapter.map) {
        action(this.mapAdapter, layer);
      } else {
        this.mapAdapter.emitter.once('create', (data) => {
          action(data.map, layer);
        });
      }
    }
  }

  requestGeomString(pixel: Pixel, pixelRadius: number) {
    if (this.mapAdapter.requestGeomString) {
      return this.mapAdapter.requestGeomString(pixel, pixelRadius);
    }
  }

  onMapClick(evt: MapClickEvent) {
    this.emitter.emit('click', evt);
  }

  selectLayer(layerId: string) {
    const layerMem = this.getLayer(layerId);
    const adapter = layerMem && layerMem.adapter as VectorLayerAdapter;
    if (adapter && adapter.select) {
      adapter.select();
    }
    this._selectedLayers.push(layerId);
  }

  unSelectLayer(layerId: string) {
    const layerMem = this.getLayer(layerId);
    const adapter = layerMem && layerMem.adapter as VectorLayerAdapter;
    if (adapter.unselect) {
      adapter.unselect();
    }
    const index = this._selectedLayers.indexOf(layerId);
    if (index !== -1) {
      this._selectedLayers.splice(index, 1);
    }
  }

  filterLayer(layerId: string, filter: DataLayerFilter<Feature, L>) {
    const layerMem = this.getLayer(layerId);
    const adapter = layerMem && layerMem.adapter as VectorLayerAdapter;
    if (adapter.filter) {
      adapter.filter(filter);
    }
  }

  setLayerData(layerId: string, data: GeoJsonObject) {
    const layerMem = this.getLayer(layerId);
    const adapter = layerMem && layerMem.adapter as VectorLayerAdapter;
    if (adapter.setData) {
      adapter.setData(data);
    }
  }

  addLayerData(layerId: string, data: GeoJsonObject) {
    const layerMem = this.getLayer(layerId);
    const adapter = layerMem && layerMem.adapter as VectorLayerAdapter;
    if (adapter.addData) {
      adapter.addData(data);
    }
  }

  clearLayerData(layerId: string, cb?: (feature: Feature) => boolean) {
    const layerMem = this.getLayer(layerId);
    const adapter = layerMem && layerMem.adapter as VectorLayerAdapter;
    if (adapter.clearLayer) {
      adapter.clearLayer(cb);
    }
  }

  getAttributions(options: GetAttributionsOptions): string[] {
    const attributions: string[] = [];
    for (const l in this._layers) {
      if (this._layers.hasOwnProperty(l)) {
        const layerMeme = this._layers[l];
        const onlyVisible = options.onlyVisible !== undefined ? options.onlyVisible : true;
        const useLayerAttr = onlyVisible ? layerMeme.onMap : true;
        if (useLayerAttr) {
          const attr = layerMeme.adapter.options && layerMeme.adapter.options.attribution;
          if (attr) {
            attributions.push(attr);
          }
        }
      }
    }
    return attributions;
  }
  // endregion

  // region MAP
  private async _setupMap() {

    this.mapAdapter.displayProjection = this.displayProjection;
    this.mapAdapter.lonlatProjection = this.lonlatProjection;

    this.mapAdapter.create(this.options);
    this._zoomToInitialExtent();

    await this._addLayerProviders();
    await this._onLoadSync();

    this._emitLoadEvent('build-map', this.mapAdapter);
    return this;
  }

  private _zoomToInitialExtent() {
    if (this._extent) {
      this.mapAdapter.fit(this._extent);
    } else if (this.options.bounds) {
      this.fit(this.options.bounds);
    } else {
      const { center, zoom } = this.options;
      this.setView(center, zoom);
    }
  }

  private async _addLayerProviders() {
    try {
      for await (const kit of this._starterKits) {
        if (kit.getLayerAdapters) {
          const adapters = await kit.getLayerAdapters.call(kit);
          if (adapters) {
            for await (const adapter of adapters) {
              // this.map.layerAdapters[adapter.name] = adapter;
              const newAdapter = await adapter.createAdapter(this);
              if (newAdapter) {
                this.mapAdapter.layerAdapters[adapter.name] = newAdapter;
              }
            }
          }
        }
      }
    } catch (er) {
      throw new Error(er);
    }
  }

  private async _onLoadSync() {
    try {
      for await (const kit of this._starterKits) {
        if (kit.onLoadSync) {
          await kit.onLoadSync.call(kit, this);
        }
      }
    } catch (er) {
      console.error(er);
    }
  }
  // endregion

  // region Events
  private _emitLoadEvent(event: string, data: any) {
    this._eventsStatus[event] = true;
    this.emitter.emit(event, data);
  }

  private async _onLayerClick(options: OnLayerClickOptions) {
    this.emitter.emit('layer:click', options);
    return Promise.resolve(options);
  }

  private _addEventsListeners() {
    // propagate map click event
    this.mapAdapter.emitter.on('click', (ev: MapClickEvent) => this._onMapClick(ev));
  }

  private _onMapClick(ev: MapClickEvent) {
    this.emitter.emit('click', ev);
    this._starterKits.forEach((x) => {
      if (x.onMapClick) {
        x.onMapClick(ev, this);
      }
    });
  }
  // endregion

}
