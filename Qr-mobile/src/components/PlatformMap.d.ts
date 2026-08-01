import React from 'react';

export default class PlatformMap extends React.Component<any> {
  animateToRegion(region: any, duration?: number): void;
  fitToCoordinates(coordinates: any[], options?: any): void;
}

export const Marker: React.ComponentType<any>;
export const Polyline: React.ComponentType<any>;
export const UrlTile: React.ComponentType<any>;
