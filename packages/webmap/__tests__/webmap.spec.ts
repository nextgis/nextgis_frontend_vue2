import { mapAdapterTests } from '../../../tests/mapAdapterTests';
import { webMapTests } from '../../../tests/webMapTests';
import { MapAdapter } from './classes/MapAdapter';

mapAdapterTests(MapAdapter);
webMapTests(MapAdapter);
