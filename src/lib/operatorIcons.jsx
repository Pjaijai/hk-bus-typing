import { Bus, BusFront, TramFront, TrainFront, Ship } from "lucide-react";
import { primaryOperator } from "./busNormalize";

// A glyph per operator so each transport type reads at a glance, not just by
// colour. Franchised buses get the front-on double-decker; the green minibus
// gets the side-profile van so it stays distinct; MTR feeder buses share the
// bus glyph; light rail is a tram, the heavy-rail MTR a train, and every ferry
// operator a ship. Lives outside busNormalize.js, which must stay JSX-free for
// the node build script.
export const OPERATOR_ICONS = {
  kmb: BusFront,
  ctb: BusFront,
  nlb: BusFront,
  gmb: Bus,
  lrtfeeder: BusFront,
  lightRail: TramFront,
  mtr: TrainFront,
  sunferry: Ship,
  fortuneferry: Ship,
  hkkf: Ship,
};

// Resolve by explicit operator key, or fall back to the primary operator of a
// route's `co` list. Unknown types fall back to a generic bus.
export function OperatorIcon({ co, operator, ...props }) {
  const key = operator ?? (co ? primaryOperator(co) : null);
  const Icon = (key && OPERATOR_ICONS[key]) || Bus;
  return <Icon {...props} />;
}
