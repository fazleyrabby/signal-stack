declare module 'react-simple-maps' {
  import { FC, ReactNode } from 'react';

  interface ComposableMapProps {
    projection?: string;
    projectionConfig?: Record<string, unknown>;
    style?: Record<string, unknown>;
    children?: ReactNode;
  }

  interface ZoomableGroupProps {
    center?: [number, number];
    scale?: number;
    children?: ReactNode;
  }

  interface GeographiesProps {
    geography: string;
    children: (args: { geographies: Array<{ rsmKey: string; id: string; properties: Record<string, unknown> }> }) => ReactNode;
  }

  interface GeographyProps {
    geography: { rsmKey: string; properties: Record<string, unknown> };
    onMouseEnter?: (event: unknown) => void;
    onMouseLeave?: () => void;
    onClick?: () => void;
    style?: {
      default: Record<string, unknown>;
      hover: Record<string, unknown>;
      pressed: Record<string, unknown>;
    };
  }

  export const ComposableMap: FC<ComposableMapProps>;
  export const ZoomableGroup: FC<ZoomableGroupProps>;
  export const Geographies: FC<GeographiesProps>;
  export const Geography: FC<GeographyProps>;
}