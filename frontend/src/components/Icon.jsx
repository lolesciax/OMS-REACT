const paths = {
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M10 21h4"],
  settings: [
    "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z",
    "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  ],
  search: ["m21 21-5-5", "M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0"],
  bag: ["M5 7h14l1 14H4L5 7Z", "M9 7V5a3 3 0 0 1 6 0v2"],
  user: ["M20 21a8 8 0 0 0-16 0", "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0"],
  orders: ["m3 7 9-4 9 4-9 4-9-4Z", "M3 7v10l9 4 9-4V7", "M12 11v10"],
  arrow: ["M4 12h16", "m14 6 6 6-6 6"],
  back: ["M20 12H4", "m10 6-6 6 6 6"],
  close: ["m6 6 12 12", "M6 18 18 6"],
  check: ["m5 12 4 4L19 6"],
  eye: [
    "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z",
    "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  ],
  refresh: [
    "M20 7v5h-5",
    "M4 17v-5h5",
    "M6 7a7 7 0 0 1 12-1l2 3",
    "M18 17a7 7 0 0 1-12 1l-2-3",
  ],
  leaf: ["M20 3c-8 0-15 2-15 9a7 7 0 0 0 7 7c7 0 8-8 8-16Z", "M4 21 15 10"],
  truck: [
    "M2 5h12v12H2Z",
    "M14 9h4l4 4v4h-8",
    "M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
    "M20 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  ],
  shield: ["m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z", "m8 12 3 3 5-6"],
  chevron: ["m9 5 7 7-7 7"],
};

export default function Icon({ name, size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {(paths[name] || paths.bag).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
