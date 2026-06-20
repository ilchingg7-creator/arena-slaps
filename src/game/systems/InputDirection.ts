export type DirectionInput = {
  down: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
};

export type DirectionVector = {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
};

export function combineMovementInput(
  ...inputs: DirectionInput[]
): DirectionVector {
  const x = inputs.reduce(
    (sum, input) => sum + Number(input.right) - Number(input.left),
    0,
  );
  const y = inputs.reduce(
    (sum, input) => sum + Number(input.down) - Number(input.up),
    0,
  );

  return {
    x: Math.sign(x) as DirectionVector["x"],
    y: Math.sign(y) as DirectionVector["y"],
  };
}
