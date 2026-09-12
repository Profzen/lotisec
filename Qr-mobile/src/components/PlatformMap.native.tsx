import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, UrlTile, Region } from 'react-native-maps';

type Coordinate = { latitude: number; longitude: number };

type MapProps = {
  children?: React.ReactNode;
  style?: any;
  initialRegion?: Coordinate & { latitudeDelta: number; longitudeDelta: number };
  onPress?: (event: { nativeEvent: { coordinate: Coordinate } }) => void;
  onMapReady?: () => void;
  showsUserLocation?: boolean;
};

export default class PlatformMap extends React.Component<MapProps> {
  private mapRef = React.createRef<MapView>();

  animateToRegion(region: Coordinate & { latitudeDelta?: number; longitudeDelta?: number }, duration = 800) {
    const r: Region = {
      latitude: region.latitude,
      longitude: region.longitude,
      latitudeDelta: region.latitudeDelta ?? 0.03,
      longitudeDelta: region.longitudeDelta ?? 0.03,
    };
    this.mapRef.current?.animateToRegion(r, duration);
  }

  fitToCoordinates(coords: Coordinate[], options?: { edgePadding?: { top: number; right: number; bottom: number; left: number }; animated?: boolean }) {
    if (!coords?.length) return;
    this.mapRef.current?.fitToCoordinates(coords, {
      edgePadding: options?.edgePadding ?? { top: 40, right: 40, bottom: 40, left: 40 },
      animated: options?.animated ?? true,
    });
  }

  render() {
    return (
      <View style={[styles.container, this.props.style]}>
        <MapView
          ref={this.mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={this.props.initialRegion}
          onPress={this.props.onPress}
          onMapReady={this.props.onMapReady}
          showsUserLocation={this.props.showsUserLocation}
          loadingEnabled
        >
          <UrlTile
            urlTemplate="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"
            maximumZ={19}
            flipY={false}
            zIndex={-1}
          />
          {this.props.children}
        </MapView>
      </View>
    );
  }
}

export { Marker, Polyline, UrlTile };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAF1F7',
    overflow: 'hidden',
  },
});
