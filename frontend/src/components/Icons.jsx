import React from 'react';

export const ICONS = {
  home: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  send: "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",
  qr: "M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M7 7v.01 M19 7v.01 M7 19v.01 M15 15h2v2h-2z M19 15h2v2h-2z M15 19h2v2h-2z M19 19h2v2h-2z",
  history: "M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  wallet: "M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5 M17 12h.01",
  copy: "M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2-2v-2 M10 2h8a2 2 0 0 1 2 2v8",
  check: "M20 6L9 17l-5-5",
  x: "M18 6L6 18 M6 6l12 12",
  arrow: "M5 12h14 M12 5l7 7-7 7",
  arrowL: "M19 12H5 M12 19l-7-7 7-7",
  share: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13",
  ext: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3",
  search: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
  dl: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  disc: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  sw: "M17 1l4 4-4 4 M3 11V9a4 4 0 0 1 4-4h14 M7 23l-4-4 4-4 M21 13v2a4 4 0 0 1-4 4H3",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  cam: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  up: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v13",
  zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  plus: "M12 5v14 M5 12h14",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  refresh: "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  alert: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 8v4 M12 16h.01",
  sun: "M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2 M6.34 17.66l-1.41 1.41 M19.07 4.93l-1.41 1.41",
  moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  bell: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0",
  more: "M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0 M12 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0 M12 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
  chart: "M18 20V10M12 20V4M6 20v-14",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01",
  chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  ticket: "M22 17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5a1 1 0 0 1 1-1 1.5 1.5 0 0 0 0-3 1 1 0 0 1-1-1V3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1.5a1 1 0 0 1-1 1 1.5 1.5 0 0 0 0 3 1 1 0 0 1 1 1z",
  flag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7",
  receipt: "M4 2v20l4-2 4 2 4-2 4 2V2l-4 2-4-2-4 2z M8 10h8 M8 14h4"
};

export const Ic = ({ name, size = 18, color = "currentColor", strokeWidth = 1.75, className = "" }) => {
  const path = ICONS[name];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <path d={path} />
    </svg>
  );
};
