import Svg, { Circle, Path, Rect } from "react-native-svg";
import { alpha, color } from "./theme";

/**
 * Spot illustrations drawn from brand tokens only (primary, primary-soft, accent, surface-raised),
 * so they recolor with the final branding. Decorative: screens carry the meaning in text.
 */
const ink = () => ({ main: color.primary, soft: color["primary-soft"], light: color["surface-raised"], accent: color.accent });

function Sparkle({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  return <Path d={`M${x} ${y - s}c${s * 0.2} ${s * 0.75} ${s * 0.25} ${s * 0.8} ${s} ${s}c-${s * 0.75} ${s * 0.2}-${s * 0.8} ${s * 0.25}-${s} ${s}c-${s * 0.2}-${s * 0.75}-${s * 0.25}-${s * 0.8}-${s}-${s}c${s * 0.75}-${s * 0.2} ${s * 0.8}-${s * 0.25} ${s}-${s}z`} fill={fill} />;
}

export function HomeIllustration({ size = 200 }: { size?: number }) {
  const c = ink();
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Circle cx={100} cy={104} r={86} fill={c.soft} />
      <Path d="M48 98 100 56l52 42v56a6 6 0 0 1-6 6H54a6 6 0 0 1-6-6z" fill={c.light} />
      <Path d="M40 104 100 54l60 50" stroke={c.main} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Rect x={86} y={118} width={28} height={42} rx={4} fill={c.main} />
      <Rect x={60} y={108} width={18} height={18} rx={3} fill={alpha(c.main, 0.25)} />
      <Rect x={122} y={108} width={18} height={18} rx={3} fill={alpha(c.main, 0.25)} />
      <Sparkle x={154} y={52} s={12} fill={c.accent} />
      <Sparkle x={40} y={60} s={7} fill={c.accent} />
      <Circle cx={162} cy={150} r={10} fill="none" stroke={c.main} strokeWidth={2.5} opacity={0.35} />
      <Circle cx={34} cy={140} r={6} fill="none" stroke={c.main} strokeWidth={2.5} opacity={0.35} />
    </Svg>
  );
}

export function PeopleIllustration({ size = 200 }: { size?: number }) {
  const c = ink();
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Circle cx={100} cy={104} r={86} fill={c.soft} />
      <Rect x={42} y={70} width={116} height={92} rx={18} fill={c.light} />
      <Circle cx={82} cy={104} r={16} fill={alpha(c.main, 0.25)} />
      <Path d="M58 146c3-14 13-22 24-22s21 8 24 22" fill={alpha(c.main, 0.25)} />
      <Circle cx={122} cy={98} r={18} fill={c.main} />
      <Path d="M96 148c4-16 14-25 26-25s22 9 26 25" fill={c.main} />
      <Circle cx={150} cy={66} r={16} fill={c.accent} />
      <Path d="m143 66 5 5 9-10" stroke={c.light} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Sparkle x={44} y={52} s={8} fill={c.accent} />
    </Svg>
  );
}

export function CalendarIllustration({ size = 200 }: { size?: number }) {
  const c = ink();
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Circle cx={100} cy={104} r={86} fill={c.soft} />
      <Rect x={46} y={58} width={108} height={104} rx={16} fill={c.light} />
      <Path d="M46 74a16 16 0 0 1 16-16h76a16 16 0 0 1 16 16v14H46z" fill={c.main} />
      <Rect x={72} y={46} width={8} height={22} rx={4} fill={c.main} />
      <Rect x={120} y={46} width={8} height={22} rx={4} fill={c.main} />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((k) => (
          <Rect key={`${r}${k}`} x={60 + k * 22} y={100 + r * 18} width={14} height={10} rx={3} fill={r === 1 && k === 2 ? c.accent : alpha(c.main, 0.18)} />
        )),
      )}
      <Circle cx={150} cy={150} r={22} fill={c.main} />
      <Path d="M150 138v12l8 5" stroke={c.light} strokeWidth={4} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function PaymentIllustration({ size = 200 }: { size?: number }) {
  const c = ink();
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Circle cx={100} cy={104} r={86} fill={c.soft} />
      <Rect x={38} y={74} width={124} height={78} rx={14} fill={c.main} />
      <Rect x={38} y={92} width={124} height={14} fill={alpha(c.light, 0.35)} />
      <Rect x={52} y={122} width={40} height={8} rx={4} fill={alpha(c.light, 0.6)} />
      <Circle cx={146} cy={136} r={26} fill={c.light} />
      <Path d="M135 136l8 8 15-16" stroke={c.main} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Sparkle x={52} y={54} s={10} fill={c.accent} />
      <Circle cx={168} cy={70} r={8} fill="none" stroke={c.main} strokeWidth={2.5} opacity={0.35} />
    </Svg>
  );
}
