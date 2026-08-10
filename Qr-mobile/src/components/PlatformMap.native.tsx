import React from 'react';
import MapView, { Marker, Polyline, UrlTile as NativeUrlTile, MapUrlTileProps } from 'react-native-maps';

const CARTODB_VOYAGER = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';

export function UrlTile(props: MapUrlTileProps) {
  return (
    <NativeUrlTile
      {...props}
      urlTemplate={CARTODB_VOYAGER}
      shouldReplaceMapContent={false}
      tileSize={256}
      maximumZ={19}
    />
  );
}

export { Marker, Polyline };
export default MapView;
