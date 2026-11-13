/** Configuration limits. The run validator also applies the smaller inversion budget. */
export function acquisitionLimits(dimension?: 2 | 3) {
  return dimension === 3
    ? { testLimit: 108, pairLimit: 1500 }
    : { testLimit: 30, pairLimit: 100 };
}
