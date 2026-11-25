/**
 * ESTAFET brand logo component rendering the official transparent PNG lockups:
 *  - `onSky`: white track + neon-lime baton + white `estafet.` lockup (`/brand/logo-dark.png`) for hero & dark footer.
 *  - `tile`: square icon tile (`/brand/logo-tile.png`) extracted from the favicon ICO.
 *  - default: dark ink track + lime baton + dark `estafet.` lockup (`/brand/logo-light.png`) for light surfaces.
 */
export function LogoMark({
  size = 28,
  onSky = false,
  tile = false,
}: {
  size?: number;
  onSky?: boolean;
  tile?: boolean;
}) {
  if (tile) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/brand/logo-tile.png"
        alt=""
        width={size}
        height={size}
        aria-hidden="true"
        className="flex-none select-none object-contain"
      />
    );
  }

  const width = Math.round(size * (828 / 176));
  const src = onSky ? "/brand/logo-dark.png" : "/brand/logo-light.png";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={width}
      height={size}
      aria-hidden="true"
      className="block flex-none select-none object-contain"
      style={{ height: size, width: "auto" }}
    />
  );
}
