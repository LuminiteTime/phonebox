// Ranking that does not jitter: a process moves up only when it clearly overtakes the one above.

const OVERTAKE = 3; // CPU points a process must lead by before it moves up

/** Previous order kept where the CPU gap is small; new names join at the end. */
export function stickyOrder(prev, groups) {
  const cpu = new Map(groups.map((g) => [g.name, g.cpu]));
  const order = prev.filter((n) => cpu.has(n));
  for (const g of groups) if (!order.includes(g.name)) order.push(g.name);
  for (let pass = 0; pass < order.length; pass++) {
    for (let i = order.length - 1; i > 0; i--) {
      if (cpu.get(order[i]) > cpu.get(order[i - 1]) + OVERTAKE) [order[i - 1], order[i]] = [order[i], order[i - 1]];
    }
  }
  return order;
}
