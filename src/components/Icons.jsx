import { COLORS } from "../constants.js";

export const SVGIcons = ({ type, size = 28 }) => {
  const props = { width: size, height: size, viewBox: "0 0 28 28", fill: "none", stroke: COLORS.heading, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    envelope: <svg {...props}><rect x="3" y="6" width="22" height="16" rx="2"/><path d="M3 8l11 7 11-7"/></svg>,
    briefcase: <svg {...props}><rect x="3" y="9" width="22" height="14" rx="2"/><path d="M10 9V6a2 2 0 012-2h4a2 2 0 012 2v3"/><line x1="3" y1="16" x2="25" y2="16"/></svg>,
    document: <svg {...props}><path d="M7 3h10l6 6v16a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"/><path d="M17 3v6h6"/><line x1="9" y1="14" x2="19" y2="14"/><line x1="9" y1="18" x2="16" y2="18"/></svg>,
    book: <svg {...props}><path d="M4 4.5A2.5 2.5 0 016.5 2H14v24H6.5A2.5 2.5 0 014 23.5z"/><path d="M14 2h7.5A2.5 2.5 0 0124 4.5v19a2.5 2.5 0 01-2.5 2.5H14"/></svg>,
    report: <svg {...props}><rect x="4" y="2" width="20" height="24" rx="2"/><line x1="9" y1="8" x2="19" y2="8"/><line x1="9" y1="12" x2="19" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/><rect x="9" y="19" width="4" height="4" rx="1"/></svg>,
    speech: <svg {...props}><path d="M4 4h20a2 2 0 012 2v12a2 2 0 01-2 2H10l-6 4v-4a2 2 0 01-2-2V6a2 2 0 012-2z"/><line x1="9" y1="10" x2="19" y2="10"/><line x1="9" y1="14" x2="15" y2="14"/></svg>,
  };
  return icons[type] || null;
};

export const FeatherIcon = ({ size = 18, color = COLORS.heading }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M28 4c-2 3-4.5 7-7 12s-4.5 10-6.5 14.5L12 35" stroke={color} strokeWidth={1.3} fill="none"/>
    <path d="M28 4c-5 1.5-9 4-12 7.5" stroke={color} strokeWidth={1.1} fill="none"/>
    <path d="M26 7c-4.5 1.5-8 4-10.5 7" stroke={color} strokeWidth={1} fill="none"/>
    <path d="M24 10.5c-4 1.5-7 3.5-9 6.5" stroke={color} strokeWidth={0.9} fill="none"/>
    <path d="M22.5 14c-3.5 1.5-6 3.5-8 6" stroke={color} strokeWidth={0.85} fill="none"/>
    <path d="M21 17.5c-3 1.5-5 3-6.5 5.5" stroke={color} strokeWidth={0.8} fill="none"/>
    <path d="M19.5 21c-2 1.5-3.5 3-5 5" stroke={color} strokeWidth={0.75} fill="none"/>
    <path d="M28 4c-.5 4-1.5 7-2.5 10" stroke={color} strokeWidth={1.1} fill="none"/>
    <path d="M26.5 7c-.5 3-1 6-2 8.5" stroke={color} strokeWidth={1} fill="none"/>
    <path d="M25 10.5c-.5 2.5-1 5-1.5 7.5" stroke={color} strokeWidth={0.9} fill="none"/>
    <path d="M23.5 14c-.3 2.5-.8 4.5-1.5 6.5" stroke={color} strokeWidth={0.85} fill="none"/>
    <path d="M22 17.5c-.3 2-.6 3.5-1 5" stroke={color} strokeWidth={0.8} fill="none"/>
    <circle cx="11.5" cy="35" r="1" fill={color} opacity="0.6"/>
    <ellipse cx="11" cy="35.5" rx="2.2" ry="0.7" fill={color} opacity="0.25"/>
    <circle cx="9" cy="35" r="0.6" fill={color} opacity="0.45"/>
    <circle cx="13" cy="35.3" r="0.4" fill={color} opacity="0.4"/>
    <circle cx="8.2" cy="34.2" r="0.35" fill={color} opacity="0.3"/>
    <path d="M10 33.5c-1.5-1-3-.5-3 .8s1.5 1.8 2.5 1c.8-.6.8-1.5 0-2" stroke={color} strokeWidth={0.8} fill="none" opacity="0.45"/>
    <circle cx="6.5" cy="33" r="0.5" fill={color} opacity="0.35"/>
    <circle cx="8" cy="35.5" r="0.4" fill={color} opacity="0.3"/>
  </svg>
);

export const LyraAvatar = ({ size = 40 }) => (
  <div style={{ width: size, height: size, borderRadius: 12, background: `linear-gradient(135deg, ${COLORS.logoBg1}, ${COLORS.logoBg2})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <FeatherIcon size={size * 0.5} />
  </div>
);
