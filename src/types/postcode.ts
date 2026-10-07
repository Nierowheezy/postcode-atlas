export interface NamedCode {
  code: string;
  name?: string;
}

export interface PostcodeSegments {
  state: string;
  lga: string;
  district: string;
  area: string;
  unit: string;
}

export interface PostcodeLocation {
  postcode: string;
  display?: string;
  compact?: string;
  state: string;
  stateName?: string;
  lga?: string;
  lgaName?: string;
  district?: string;
  area?: string;
  unit?: string;
  lat?: number;
  lng?: number;
  address?: string;
  buildingUse?: 'residential' | 'non-residential' | 'commercial' | 'mixed' | string;
  distance_m?: number;
  /** Landmark/building name, where the NDAPS record supplies one. */
  name?: string;
  /** Coarse classification used to group discovery landmarks. */
  category?: string;
  status?: string;
  valid?: boolean;
  verified?: boolean;
  locality?: string;
}

export interface StateGeoInfo {
  code: string;
  name: string;
  capital: string;
  zone: 'North Central' | 'North East' | 'North West' | 'South East' | 'South South' | 'South West';
  center: [number, number]; // [lat, lng]
  zoom: number;
  lgaCount: number;
}

export interface SearchResultItem {
  id: string;
  type: 'postcode' | 'state' | 'lga' | 'area';
  title: string;
  subtitle: string;
  code?: string;
  coordinates: [number, number]; // [lat, lng]
  zoom?: number;
  stateCode?: string;
  lgaCode?: string;
  location?: PostcodeLocation;
}

export type MapViewMode = 'map' | 'data' | 'density';

export interface HuntChallenge {
  id: string;
  title: string;
  targetPostcode: string;
  hintState: string;
  hintLGA: string;
  hintArea: string;
  coordinates: [number, number];
  solved: boolean;
  attempts: number;
}
