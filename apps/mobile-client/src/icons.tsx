import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

/** 24×24 stroke icons drawn for this app. Decorative: the surrounding control carries the label. */
const PATHS = {
  home: <Path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />,
  people: (
    <>
      <Circle cx={9} cy={8} r={3.5} />
      <Path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
      <Path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.9c1.6.8 2.7 2.5 3 5.1" />
    </>
  ),
  calendar: (
    <>
      <Rect x={3.5} y={5} width={17} height={15.5} rx={2.5} />
      <Path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  clock: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 7.5V12l3 2" />
    </>
  ),
  pin: (
    <>
      <Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <Circle cx={12} cy={10} r={2.3} />
    </>
  ),
  wallet: (
    <>
      <Rect x={3} y={6} width={18} height={13} rx={2.5} />
      <Path d="M3 10h18M16 14.5h1.5" />
    </>
  ),
  person: (
    <>
      <Circle cx={12} cy={8.5} r={4} />
      <Path d="M4.5 20.5c.8-4 3.7-6 7.5-6s6.7 2 7.5 6" />
    </>
  ),
  chevron: <Path d="m9.5 6 6 6-6 6" />,
  check: <Path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 7.5v5.5M12 16.2v.3" />
    </>
  ),
  logout: (
    <>
      <Path d="M14 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H14" />
      <Path d="M10.5 12H20M16.5 8.5 20 12l-3.5 3.5" />
    </>
  ),
  back: <Path d="M15 5.5 8.5 12l6.5 6.5" />,
  star: <Path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6L12 16.6l-5 2.7.9-5.6-4-4 5.6-.8z" />,
  sparkle: (
    <>
      <Path d="M10 3.5c.5 3.6 2 5.1 5.5 5.5-3.5.5-5 2-5.5 5.5-.5-3.5-2-5-5.5-5.5 3.5-.4 5-1.9 5.5-5.5z" />
      <Path d="M17.5 13.5c.3 2 1.1 2.8 3 3-1.9.3-2.7 1.1-3 3-.2-1.9-1-2.7-3-3 2-.2 2.8-1 3-3z" />
    </>
  ),
  drop: <Path d="M12 3.5s-6 6.4-6 10.7a6 6 0 0 0 12 0C18 9.9 12 3.5 12 3.5z" />,
  broom: (
    <>
      <Path d="M19.5 4.5 13 11" />
      <Path d="M10.8 9.2 15 13.4c-1 3.6-3.6 6.2-8.6 6.6-.6-5 2.2-8.6 4.4-10.8z" />
      <Path d="M8.5 15.5 6 18" />
    </>
  ),
  shield: (
    <>
      <Path d="M12 3.5 5 6.2v5.3c0 4.4 3 7.7 7 9 4-1.3 7-4.6 7-9V6.2z" />
      <Path d="m9 12 2.2 2.2L15.2 10" />
    </>
  ),
  mail: (
    <>
      <Rect x={3.5} y={5.5} width={17} height={13} rx={2.5} />
      <Path d="m4.5 7 7.5 6 7.5-6" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, color, strokeWidth = 1.8, filled = false }: { name: IconName; size?: number; color: ColorValue; strokeWidth?: number; filled?: boolean }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : "none"}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </Svg>
  );
}
