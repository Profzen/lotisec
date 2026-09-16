import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, {
  Marker,
  Polyline,
  UrlTile as NativeUrlTile,
  MapUrlTileProps,
  Region,
} from 'react-native-maps';

export { Marker, Polyline };

const CARTO_VOYAGER =
  'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png';

export function UrlTile(props: Partial<MapUrlTileProps> & { urlTemplate?: string }) {
  const { urlTemplate = CARTO_VOYAGER, ...rest } = props;
  return (
    <NativeUrlTile
      maximumZ={19}
      flipY={false}
      tileSize={256}
      zIndex={-1}
      {...rest}
      urlTemplate={urlTemplate}
    />
  );
}

export default class PlatformMap extends React.Component<any> {
  private mapRef = React.createRef<MapView>();

  animateToRegion(region: Region, duration = 800) {
    this.mapRef.current?.animateToRegion(region, duration);
  }

  fitToCoordinates(
    coords: Array<{ latitude: number; longitude: number }>,
    options?: {
      edgePadding?: { top: number; right: number; bottom: number; left: number };
      animated?: boolean;
    }
  ) {
    if (!coords || coords.length === 0) return;
    this.mapRef.current?.fitToCoordinates(coords, {
      edgePadding: options?.edgePadding ?? { top: 50, right: 50, bottom: 50, left: 50 },
      animated: options?.animated ?? true,
    });
  }

  render() {
    const { children, style, ...rest } = this.props;
    const hasChildTile = React.Children.toArray(children).some(
      (child: any) =>
        child?.type === NativeUrlTile ||
        child?.type === UrlTile ||
        child?.props?.urlTemplate
    );

    return (
      <View style={[styles.container, style]}>
        <MapView
          ref={this.mapRef}
          style={StyleSheet.absoluteFillObject}
          loadingEnabled={true}
          {...rest}
        >
          {!hasChildTile && <UrlTile />}
          {children}
        </MapView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#EAF1F7',
  },
});
