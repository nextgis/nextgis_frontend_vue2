import { MainLayerAdapter, TileAdapterOptions } from '@nextgis/webmap';
import { TileAdapter } from './TileAdapter';

const OPTIONS = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://osm.org/copyright" target="_blank">OpenStreetMap</a> contributors',
  subdomains: 'abc',
  name: 'OpenStreetMap',
};

export class OsmAdapter extends TileAdapter implements MainLayerAdapter {
  addLayer(options: Omit<TileAdapterOptions, 'url'>): string[] | undefined {
    return super.addLayer(Object.assign({}, OPTIONS, options));
  }
}
