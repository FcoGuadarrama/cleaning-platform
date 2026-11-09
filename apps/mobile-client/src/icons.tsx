import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

/** 24×24 stroke icons drawn for this app. Decorative: the surrounding control carries the label. */
const PATHS = {
  home: <Path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />,
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
  back: <Path d="M15 5.5 8.5 12l6.5 6.5" />,
  star: <Path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6L12 16.6l-5 2.7.9-5.6-4-4 5.6-.8z" />,
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
  bell: (
    <>
      <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
      <Path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  chevronDown: <Path d="m6 9.5 6 6 6-6" />,
  arrow: <Path d="M4.5 12h15M13.5 6l6 6-6 6" />,
  bucket: (
    <>
      <Path d="M4 8.5h16" />
      <Path d="M5.5 8.5 7 19.5a1.5 1.5 0 0 0 1.5 1h7a1.5 1.5 0 0 0 1.5-1l1.5-11" />
      <Path d="M6.5 8.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    </>
  ),
  sliders: (
    <>
      <Path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
      <Circle cx={15} cy={7} r={2} />
      <Circle cx={9} cy={12} r={2} />
      <Circle cx={17} cy={17} r={2} />
    </>
  ),
  layers: (
    <>
      <Path d="m12 4 8.5 4.5L12 13 3.5 8.5z" />
      <Path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5l8.5 4.5 8.5-4.5" />
    </>
  ),
  card: (
    <>
      <Rect x={3} y={5.5} width={18} height={13} rx={2} />
      <Path d="M3 10h18" />
    </>
  ),
  receipt: (
    <>
      <Path d="M6 3.5h9l3.5 3.5v13.5H6z" />
      <Path d="M15 3.5V7h3.5M9 11h6M9 14.5h6M9 18h3" />
    </>
  ),
  headset: (
    <>
      <Path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2" />
      <Rect x={3.5} y={13} width={4} height={6} rx={1.5} />
      <Rect x={16.5} y={13} width={4} height={6} rx={1.5} />
      <Path d="M18.5 19c0 1.2-1.5 2-4 2H13" />
    </>
  ),
  info: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 11v5M12 7.8v.2" />
    </>
  ),
  spray: (
    <>
      <Path d="M7.5 21h7a1 1 0 0 0 1-1v-6.5a4 4 0 0 0-2-3.5V8h-4v2a4 4 0 0 0-2 3.5V20a1 1 0 0 0 1 1z" />
      <Path d="M9.5 8V5h5l2.5 2M9.5 5H7" />
    </>
  ),
  message: <Path d="M20 11.5a7.5 7 0 0 1-11 6.2L4.5 19l1.3-3.8A7 7 0 0 1 4.5 11.5a7.75 7 0 0 1 15.5 0z" />,
  paw: (
    <>
      <Circle cx={8.5} cy={7} r={1.8} />
      <Circle cx={15.5} cy={7} r={1.8} />
      <Circle cx={5} cy={11.5} r={1.6} />
      <Circle cx={19} cy={11.5} r={1.6} />
      <Path d="M12 11.5c-2.5 0-5 3.5-5 5.5 0 1.6 1.4 2.5 2.7 2.2.9-.2 1.5-.6 2.3-.6s1.4.4 2.3.6c1.3.3 2.7-.6 2.7-2.2 0-2-2.5-5.5-5-5.5z" />
    </>
  ),
  flag: <Path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11" />,
  circle: <Circle cx={12} cy={12} r={8} />,
  square: <Rect x={4.5} y={4.5} width={15} height={15} rx={3} />,
  plus: <Path d="M12 5v14M5 12h14" />,
  trash: <Path d="M4.5 7h15M10 4h4M6.5 7l.9 12a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12M10 11v5.5M14 11v5.5" />,
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
