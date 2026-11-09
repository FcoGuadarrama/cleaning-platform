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

/**
 * Stand-in for the brand's interior photography (docs/rfc/brisa-feature-gaps.md): a sunlit corner
 * with window, table and flowers, drawn in tokens. Stretches to fill its box.
 */
export function HomeScene() {
  const c = ink();
  return (
    <Svg width="100%" height="100%" viewBox="0 0 380 150" preserveAspectRatio="xMidYMid slice">
      <Rect width={380} height={150} fill={c.soft} />
      <Rect x={232} y={0} width={124} height={150} fill={c.light} />
      <Path d="M232 0v150M294 0v150M232 58h124M356 0v150" stroke={c.main} strokeWidth={6} />
      <Path d="M246 150c8-30 22-52 40-64M318 150c-4-26 4-46 22-62" stroke={alpha(c.accent, 0.55)} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d="M300 30c10 6 22 6 34-2M246 24c14 4 26 2 36-8" stroke={alpha(c.accent, 0.45)} strokeWidth={4} strokeLinecap="round" fill="none" />
      <Rect x={20} y={104} width={250} height={10} rx={3} fill={c.main} />
      <Path d="M38 114v36M252 114v36" stroke={c.main} strokeWidth={6} />
      <Path d="M20 104h250l-14 22H34z" fill={alpha(c.light, 0.9)} />
      <Path d="M70 104c-6-14-6-26 4-34h18c10 8 10 20 4 34z" fill={c.light} stroke={c.main} strokeWidth={3} />
      <Path d="M83 70V40M83 52c-10-4-16-12-16-22M83 46c10-4 16-12 16-22" stroke={c.main} strokeWidth={3} strokeLinecap="round" fill="none" />
      <Circle cx={83} cy={34} r={10} fill={c.accent} />
      <Circle cx={66} cy={26} r={8} fill={alpha(c.accent, 0.75)} />
      <Circle cx={100} cy={22} r={8} fill={alpha(c.accent, 0.75)} />
      <Path d="M130 104v-14h22v14M152 94h6a4 4 0 0 1 0 8h-6" fill={c.light} stroke={c.main} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M168 0v60M150 60h36l-6 14h-24z" stroke={c.main} strokeWidth={3} fill={c.light} strokeLinejoin="round" />
    </Svg>
  );
}
