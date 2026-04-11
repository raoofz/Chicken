export function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="50" cy="50" r="48" fill="#B85C2A" opacity="0.12" />
      <ellipse cx="50" cy="62" rx="22" ry="18" fill="#C4652E" />
      <ellipse cx="50" cy="58" rx="20" ry="16" fill="#D4762A" />
      <circle cx="50" cy="38" r="15" fill="#D4762A" />
      <circle cx="50" cy="38" r="13" fill="#E08535" />
      <polygon points="50,20 53,28 47,28" fill="#C4652E" />
      <polygon points="50,16 54,24 46,24" fill="#D44A2A" />
      <polygon points="50,13 53,20 47,20" fill="#C4652E" />
      <circle cx="44" cy="35" r="3" fill="#1A1208" />
      <circle cx="44.5" cy="34.5" r="1" fill="white" />
      <path d="M 38 40 Q 35 43 38 44" stroke="#C4652E" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M 38 44 L 35 46" stroke="#C4652E" strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="50" cy="76" rx="12" ry="6" fill="#B85C2A" />
      <line x1="44" y1="80" x2="42" y2="88" stroke="#B85C2A" strokeWidth="3" strokeLinecap="round" />
      <line x1="50" y1="81" x2="50" y2="89" stroke="#B85C2A" strokeWidth="3" strokeLinecap="round" />
      <line x1="56" y1="80" x2="58" y2="88" stroke="#B85C2A" strokeWidth="3" strokeLinecap="round" />
      <path d="M 64 55 Q 72 50 70 58 Q 72 62 66 62 Q 68 58 64 55" fill="#E08535" />
    </svg>
  );
}
