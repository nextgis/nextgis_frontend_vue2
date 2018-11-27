import { GeoJsonObject, Feature } from 'geojson';
import { LatLng } from './BaseTypes';

export interface AdapterOptions {
  id?: string;
  url?: string;
  transparency?: number;
  // visibility: item.layer_enabled,
  minResolution?: number;
  maxResolution?: number;
  order?: number;
  // move out of here
  styleId?: number;
}

export interface MvtAdapterOptions extends AdapterOptions {
  paint?;
  type?: 'fill' | 'line' | 'circle' | 'point';
  'source-layer'?: string;
}

export type GeoJsonAdapterLayerType = 'fill' | 'circle' | 'line';

export interface IconOptions {
  className?: string;
  html?: string;
  iconSize?: [number, number];
  iconAnchor?: [number, number];
}

export interface GeoJsonAdapterLayerPaint {
  color?: string;
  opacity?: number;
  weight?: number;
  radius?: number;
  stroke?: boolean;
  icon?: boolean | IconOptions;
}

export type GetPaintCallback = (feature: Feature<any>) => GeoJsonAdapterLayerPaint;

export interface GeoJsonAdapterOptions extends AdapterOptions {
  data?: GeoJsonObject;
  type?: GeoJsonAdapterLayerType;
  paint?: GeoJsonAdapterLayerPaint | GetPaintCallback;
  selectedPaint?: GeoJsonAdapterLayerPaint | GetPaintCallback;
}

export interface MarkerAdapterOptions extends AdapterOptions {
  latLng: LatLng;
}

export interface ImageAdapterOptions extends AdapterOptions {
  resourceId: string | number;
  updateWmsParams?: (object) => object;
}

export interface LayerAdapters {
  'MVT': MvtAdapterOptions;
  'IMAGE': ImageAdapterOptions;
  'OSM': AdapterOptions;
  'TILE': AdapterOptions;
  'MARKER': MarkerAdapterOptions;
  'GEOJSON': GeoJsonAdapterOptions;
  [name: string]: AdapterOptions;
}

export interface LayerAdapter<M = any, O = any> {
  name: string;
  layer?: any;
  map?: M;
  selected?: boolean;
  addLayer(options: O): any;

  select?(): void;
  unselect?(): void;
}
