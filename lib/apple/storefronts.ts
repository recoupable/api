/**
 * Every Apple Music storefront id, fetched from `GET /v1/storefronts` on
 * 2026-08-17 (167 territories). Held as a constant so an unknown storefront is
 * a local 400 rather than a wasted round trip to Apple's `Unknown Storefront`.
 */
export const APPLE_STOREFRONTS = new Set(
  (
    "ae ag ai am ao ar at au az ba bb be bg bh bj bm bo br bs bt bw by bz ca cd cg ch ci cl cm cn " +
    "co cr cv cy cz de dk dm do dz ec ee eg es fi fj fm fr ga gb gd ge gh gm gr gt gw gy hk hn hr " +
    "hu id ie il in iq is it jm jo jp ke kg kh kn kr kw ky kz la lb lc lk lr lt lu lv ly ma md me " +
    "mg mk ml mm mn mo mr ms mt mu mv mw mx my mz na ne ng ni nl no np nz om pa pe pg ph pl pt py " +
    "qa ro rs ru rw sa sb sc se sg si sk sl sn sr sv sz tc td th tj tm tn to tr tt tw tz ua ug us " +
    "uy uz vc ve vg vn vu xk ye za zm zw"
  ).split(" "),
);

/** Apple's own default storefront, and the one our catalog work uses. */
export const DEFAULT_STOREFRONT = "us";
