/** Ícones de traço fino (estilo Lucide), desenhados aqui para não depender de pacote. */
const P: Record<string, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></>,
  building: <><rect x="4" y="3" width="11" height="18" rx="1" /><path d="M15 9h4a1 1 0 0 1 1 1v11h-5" /><path d="M8 7h3M8 11h3M8 15h3" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.5 3.5 5.2" /></>,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  receipt: <><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  wallet: <><path d="M4 7h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11" /><circle cx="16" cy="13.5" r="1.2" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chev: <path d="m9 6 6 6-6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  refresh: <><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" /><path d="M4 3.5V8h4.5" /><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" /><path d="M20 20.5V16h-4.5" /></>,
  alert: <><path d="M12 3.5 2.8 19.5h18.4z" /><path d="M12 10v4M12 17h.01" /></>,
  arrow: <path d="M7 17 17 7M8 7h9v9" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5" /></>,
  logo: <><path d="M12 2.5 21.5 12 12 21.5 2.5 12z" /><path d="M12 7.5 16.5 12 12 16.5 7.5 12z" /></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5M5 12h11" /></>,
  coins: <><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" /><path d="M15 11.2c3.4.3 6 1.6 6 3.3 0 1.9-2.7 3.5-6 3.5-1.6 0-3-.3-4.1-.9" /><path d="M21 14.5V18c0 1.9-2.7 3.5-6 3.5-2.5 0-4.6-.9-5.5-2.2" /></>,
  repeat: <><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></>,
  upload: <><path d="M12 15V3M7 8l5-5 5 5" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  bank: <><path d="M3 10 12 4l9 6" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></>,
};
export type IconName = keyof typeof P;

export function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg className={`i ${className ?? ""}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{P[name]}</svg>
  );
}
