import React, { useMemo } from 'react';
import MapboxGL from '../lib/mapbox';

type CarPuckProps = {
  id?: string;
  coordinate: [number, number];
  bearing: number;
  mapBearing?: number;
  rotateWithMap?: boolean;
  use3D?: boolean;
  modelSource: number;
  iconSource: number;
  modelScale?: [number, number, number];
  modelTranslation?: [number, number, number];
  iconSize?: number;
};

const CarPuck = ({
  id = 'car-puck',
  coordinate,
  bearing,
  mapBearing = 0,
  rotateWithMap = true,
  use3D = true,
  modelSource,
  iconSource,
  modelScale = [1.2, 1.2, 1.2],
  modelTranslation = [0, 0, 1.2],
  iconSize = 0.12,
}: CarPuckProps) => {
  const supportsModelLayer = !!(MapboxGL.Models && MapboxGL.ModelLayer);
  const render3D = use3D && supportsModelLayer;
  const modelId = `${id}-model`;
  const iconId = `${id}-icon`;
  const shape = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {
        bearing,
        rotation: rotateWithMap ? [0, 0, bearing] : [0, 0, -mapBearing],
      },
      geometry: {
        type: 'Point' as const,
        coordinates: coordinate,
      },
    }),
    [bearing, coordinate],
  );

  if (render3D) {
    return (
      <>
        <MapboxGL.Models models={{ [modelId]: modelSource }} />
        <MapboxGL.ShapeSource id={`${id}-source`} shape={shape}>
          <MapboxGL.ModelLayer
            id={`${id}-layer`}
            style={{
              modelId,
              modelScale,
              modelRotation: ['get', 'rotation'],
              modelTranslation,
            }}
          />
        </MapboxGL.ShapeSource>
      </>
    );
  }

  const iconRotation = rotateWithMap ? ['get', 'bearing'] : 0;
  const rotationAlignment = rotateWithMap ? 'map' : 'viewport';
  return (
    <>
      <MapboxGL.Images images={{ [iconId]: iconSource }} />
      <MapboxGL.ShapeSource id={`${id}-source`} shape={shape}>
        <MapboxGL.SymbolLayer
          id={`${id}-layer`}
          style={{
            iconImage: iconId,
            iconSize,
            iconRotate: iconRotation,
            iconRotationAlignment: rotationAlignment,
            iconPitchAlignment: 'map',
            iconAllowOverlap: true,
            iconIgnorePlacement: true,
            iconAnchor: 'center',
          }}
        />
      </MapboxGL.ShapeSource>
    </>
  );
};

export default CarPuck;
